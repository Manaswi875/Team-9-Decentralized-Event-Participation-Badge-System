/**
 * Read operations for the accounts collection and the helper that
 * assembles the public-facing account payload returned by auth endpoints.
 */

const { getStore } = require("../store");
const { normalizeEmail } = require("../lib/security");
const { getEvent } = require("../helpers/eventHelpers");
const { buildPublicVerifyUrl } = require("../helpers/urlHelpers");
const { getGuestForAccount, summarizeGuest } = require("./guestService");

/** @param {string} accountId */
function getAccountById(accountId) {
  return getStore().accounts.find((a) => a.accountId === accountId);
}

/** @param {string} email - Raw (un-normalized) email address */
function getAccountByEmail(email) {
  return getStore().accounts.find((a) => a.email === normalizeEmail(email));
}

/**
 * Return all minted badges whose wallet address matches the account's wallet.
 * Sorted newest-first.
 *
 * @param {{ walletAddress: string }} account
 * @returns {Array<object>}
 */
function getBadgesForAccount(account) {
  return getStore()
    .guests.filter(
      (guest) => guest.claim?.walletAddress === account.walletAddress,
    )
    .map((guest) => ({
      tokenId: guest.claim.tokenId,
      claimedAt: guest.claim.claimedAt,
      txHash: guest.claim.txHash,
      eventId: guest.claim.eventId,
      // Prefer the name stored in the claim; fall back to the current global event name.
      eventName: guest.claim.eventName || getEvent().name,
      verifyUrl: `/verify/${encodeURIComponent(guest.claim.tokenId)}`,
      contractAddress: guest.claim.contractAddress,
    }))
    .sort(
      (left, right) => new Date(right.claimedAt) - new Date(left.claimedAt),
    );
}

/**
 * Build the public account shape returned by auth and claim endpoints.
 * Includes the linked guest record (if any) and all minted badges.
 *
 * @param {object} account
 * @returns {object}
 */
function getAccountPayload(account) {
  const guest = getGuestForAccount(account);

  return {
    accountId: account.accountId,
    email: account.email,
    walletAddress: account.walletAddress,
    createdAt: account.createdAt,
    eligibleGuest: guest ? summarizeGuest(guest) : null,
    badges: getBadgesForAccount(account),
  };
}

module.exports = {
  getAccountById,
  getAccountByEmail,
  getBadgesForAccount,
  getAccountPayload,
};
