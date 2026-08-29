/**
 * Endpoints that drive the badge-claim flow for attendees:
 *
 *  GET  /api/claims/context   – Public: return claim status for a token
 *  POST /api/claims/claim     – Authenticated: mint the badge to the account wallet
 *  POST /api/claims/refresh   – Authenticated: reset a claim so it can be reminted
 */

const { Router } = require("express");
const { ethers } = require("ethers");

const { getStore, persistStore } = require("../store");
const {
  mintBadge,
  burnBadge,
  isChainConfigured,
} = require("../lib/blockchain");
const {
  verifyPassword,
  createToken,
  normalizeEmail,
} = require("../lib/security");
const config = require("../lib/config");
const {
  buildPublicClaimUrl,
  buildPublicVerifyUrl,
} = require("../helpers/urlHelpers");
const { getEvent } = require("../helpers/eventHelpers");
const { requireAuth } = require("../middleware/auth");
const {
  getGuestByClaimToken,
  getGuestForAccount,
  getGuestEventId,
  getGuestEventName,
  summarizeGuest,
} = require("../services/guestService");
const { getAccountById } = require("../services/accountService");
const { getAccountPayload } = require("../services/accountService");
const { sendClaimReadyEmail } = require("../services/emailService");

const router = Router();

router.get("/api/claims/context", (req, res) => {
  const claimToken = String(req.query.token || "").trim();
  if (!claimToken) {
    res.status(400).json({ error: "Claim token is required." });
    return;
  }

  const guest = getGuestByClaimToken(claimToken);
  if (!guest) {
    res.status(404).json({ error: "Claim invitation not found." });
    return;
  }

  // Derive claim status: already claimed → claimable (checked in) → awaiting check-in.
  const status = guest.claim?.claimedAt
    ? "claimed"
    : guest.checkedInAt
    ? "claimable"
    : "awaiting-check-in";

  res.json({
    event: getEvent(),
    claimToken,
    guest: summarizeGuest(guest),
    status,
    claimUrl: buildPublicClaimUrl(guest),
  });
});

router.post("/api/claims/claim", requireAuth, async (req, res) => {
  const account = getAccountById(req.account.accountId);
  const claimToken = String(req.body?.claimToken || "").trim();

  // Prefer the explicit claim token; fall back to the guest linked to this account.
  const guest = claimToken
    ? getGuestByClaimToken(claimToken)
    : getGuestForAccount(account);

  if (!guest) {
    res
      .status(404)
      .json({ error: "No eligible guest record was found for this account." });
    return;
  }

  if (normalizeEmail(guest.email) !== account.email) {
    res.status(403).json({
      error:
        "This claim link belongs to a different email address than the logged-in account.",
    });
    return;
  }

  if (!guest.checkedInAt) {
    res
      .status(409)
      .json({ error: "The guest must be checked in before claiming a badge." });
    return;
  }

  // Idempotent: return the existing claim if already minted.
  if (guest.claim?.claimedAt) {
    res.json({
      success: true,
      alreadyClaimed: true,
      claim: guest.claim,
      verifyUrl: `/verify/${encodeURIComponent(guest.claim.tokenId)}`,
    });
    return;
  }

  if (!isChainConfigured(config)) {
    res.status(503).json({
      error:
        "Blockchain minting is not configured yet. Set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS to enable claims.",
    });
    return;
  }

  try {
    const guestEventId = getGuestEventId(guest);
    const guestEventName = getGuestEventName(guest);
    const mintResult = await mintBadge(
      config,
      account.walletAddress,
      guestEventId,
    );

    guest.claim = {
      claimedAt: new Date().toISOString(),
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
      blockNumber: mintResult.blockNumber,
      walletAddress: account.walletAddress,
      eventId: guestEventId,
      eventName: guestEventName,
      contractAddress: config.CONTRACT_ADDRESS,
      verifyUrl: buildPublicVerifyUrl(mintResult.tokenId),
    };

    persistStore();

    res.json({
      success: true,
      claim: guest.claim,
      verifyUrl: `/verify/${encodeURIComponent(mintResult.tokenId)}`,
      account: getAccountPayload(account),
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Badge minting failed.", details: error.message });
  }
});

router.post("/api/claims/refresh", requireAuth, async (req, res) => {
  const account = getAccountById(req.account.accountId);
  const claimToken = String(req.body?.claimToken || "").trim();
  const currentPassword = String(req.body?.currentPassword || "");
  const resendEmail = req.body?.resendEmail !== false;

  const guest = claimToken
    ? getGuestByClaimToken(claimToken)
    : getGuestForAccount(account);

  if (!guest) {
    res
      .status(404)
      .json({ error: "No eligible guest record was found for this account." });
    return;
  }

  if (normalizeEmail(guest.email) !== account.email) {
    res.status(403).json({
      error:
        "This claim link belongs to a different email address than the logged-in account.",
    });
    return;
  }

  if (!guest.checkedInAt) {
    res.status(409).json({
      error: "The guest must be checked in before refreshing the claim flow.",
    });
    return;
  }

  let resetMode = "local-reset";
  let burnResult = null;
  const existingTokenId = guest.claim?.tokenId ?? null;

  // If there is an existing token, attempt to burn it on-chain first.
  if (existingTokenId != null) {
    if (isChainConfigured(config)) {
      try {
        burnResult = await burnBadge(config, existingTokenId);
        resetMode = "burned-on-chain";
      } catch (error) {
        // On-chain burn failed — fall back to wallet rotation if a password was supplied.
        if (!currentPassword) {
          res.status(409).json({
            error:
              "The existing token could not be burned on-chain. Provide your current password so we can rotate to a fresh demo wallet for another mint test.",
            details: error.message,
          });
          return;
        }
      }
    } else if (!currentPassword) {
      res.status(409).json({
        error:
          "Blockchain burn is not configured. Provide your current password so we can rotate to a fresh demo wallet for another mint test.",
      });
      return;
    }

    // If we couldn't burn on-chain, rotate the wallet address instead.
    if (!burnResult) {
      const valid = await verifyPassword(
        currentPassword,
        account.passwordSalt,
        account.passwordHash,
      );
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }

      const replacementWallet = ethers.Wallet.createRandom();
      account.walletAddress = replacementWallet.address;
      account.encryptedWalletJson = await replacementWallet.encrypt(
        currentPassword,
      );
      resetMode = "rotated-wallet";
    }
  }

  // Clear the claim and rotate the claim token so the old link can't be reused.
  guest.claim = null;
  guest.claimToken = createToken(12);
  guest.claimEmailSentAt = null;

  let claimEmailResult = {
    skipped: true,
    claimUrl: buildPublicClaimUrl(guest),
  };

  if (resendEmail) {
    try {
      claimEmailResult = await sendClaimReadyEmail(guest);
    } catch (error) {
      persistStore();
      res.status(502).json({
        error:
          "The claim was refreshed, but the new claim email could not be sent.",
        details: error.message,
        resetMode,
        claimUrl: buildPublicClaimUrl(guest),
        burnedTokenId: existingTokenId,
        burnTxHash: burnResult?.txHash || null,
      });
      return;
    }
  }

  persistStore();

  res.json({
    success: true,
    resetMode,
    claimUrl: claimEmailResult.claimUrl,
    claimEmailSent: !claimEmailResult.skipped,
    burnedTokenId: existingTokenId,
    burnTxHash: burnResult?.txHash || null,
    guest: summarizeGuest(guest),
    account: getAccountPayload(account),
  });
});

module.exports = router;
