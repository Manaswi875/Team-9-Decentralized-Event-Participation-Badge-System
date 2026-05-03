/**
 * Account authentication endpoints:
 *
 *  POST /api/auth/register        – Create account + custodial wallet
 *  POST /api/auth/login           – Verify credentials and issue a session token
 *  POST /api/auth/forgot-password – Remove the account so the user can start fresh
 *  GET  /api/auth/me              – Return the authenticated account payload
 */

const { Router } = require("express");
const { ethers } = require("ethers");

const { getStore, persistStore, refreshStoreFromDisk } = require("../store");
const {
  normalizeEmail,
  hashPassword,
  verifyPassword,
  createId,
  createSessionToken,
} = require("../lib/security");
const config = require("../lib/config");
const { requireAuth } = require("../middleware/auth");
const {
  getAccountByEmail,
  getAccountById,
  getAccountPayload,
} = require("../services/accountService");
const { getEvent } = require("../helpers/eventHelpers");

const router = Router();

router.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  if (password.length < 8) {
    res
      .status(400)
      .json({ error: "Use a password with at least 8 characters." });
    return;
  }

  if (getAccountByEmail(email)) {
    res
      .status(409)
      .json({ error: "An account already exists for this email." });
    return;
  }

  // Create a custodial Ethereum wallet encrypted with the user's password.
  // The encrypted JSON is stored so the user can export or rotate the wallet later.
  const wallet = ethers.Wallet.createRandom();
  const encryptedWalletJson = await wallet.encrypt(password);
  const passwordDigest = await hashPassword(password);

  const account = {
    accountId: createId("acct"),
    email,
    passwordSalt: passwordDigest.salt,
    passwordHash: passwordDigest.hash,
    walletAddress: wallet.address,
    encryptedWalletJson,
    createdAt: new Date().toISOString(),
  };

  getStore().accounts.push(account);
  persistStore();

  const authToken = createSessionToken(
    account.accountId,
    config.SESSION_SECRET,
  );
  res.status(201).json({
    success: true,
    authToken,
    account: getAccountPayload(account),
  });
});

router.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const account = getAccountByEmail(email);

  if (!account) {
    // Return the same error message for missing accounts and wrong passwords
    // to prevent user enumeration.
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const valid = await verifyPassword(
    password,
    account.passwordSalt,
    account.passwordHash,
  );
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const authToken = createSessionToken(
    account.accountId,
    config.SESSION_SECRET,
  );
  res.json({
    success: true,
    authToken,
    account: getAccountPayload(account),
  });
});

router.post("/api/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const account = getAccountByEmail(email);
  if (account) {
    // Delete the account so the user can re-register with the same email.
    // Badge claims are tied to the wallet address, not the account, so they persist.
    const store = getStore();
    store.accounts = store.accounts.filter(
      (a) => a.accountId !== account.accountId,
    );
    persistStore();
  }

  // Always return success to avoid leaking whether the email has an account.
  res.json({
    success: true,
    message:
      "If an account exists for that email, it has been removed. You can create it again now.",
  });
});

router.get("/api/auth/me", requireAuth, (req, res) => {
  // Re-read from disk in case another process updated the store.
  refreshStoreFromDisk();
  const account = getAccountById(req.account.accountId);

  res.json({
    success: true,
    event: getEvent(),
    account: getAccountPayload(account),
  });
});

module.exports = router;
