/**
 * Builds the externally-accessible URLs that are embedded in emails and
 * API responses.  Keeping them here makes the base-URL logic easy to find
 * and change in one place.
 */

const config = require("../lib/config");

/**
 * Build the full public URL that a guest uses to claim their badge.
 *
 * @param {{ claimToken: string }} guest
 * @returns {string}
 */
function buildPublicClaimUrl(guest) {
  return `${config.BASE_URL}/claim?token=${encodeURIComponent(
    guest.claimToken,
  )}`;
}

/**
 * Build the full public URL for verifying a minted badge on-chain.
 *
 * @param {number|string} tokenId
 * @returns {string}
 */
function buildPublicVerifyUrl(tokenId) {
  return `${config.BASE_URL}/verify/${encodeURIComponent(tokenId)}`;
}

module.exports = { buildPublicClaimUrl, buildPublicVerifyUrl };
