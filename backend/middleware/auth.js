/**
 * Express middleware that enforces authentication on protected routes.
 *
 * Token flow
 *  1. Extract the Bearer token from the Authorization header
 *  2. Verify the JWT signature and expiry via verifySessionToken
 *  3. Load the matching account from the store
 *  4. Attach it to req.account so route handlers don't repeat the lookup
 */

const { verifySessionToken } = require("../lib/security");
const { getAccountById } = require("../services/accountService");
const config = require("../lib/config");

/**
 * Extract the raw token string from the Authorization header.
 * Returns null when the header is absent or not in Bearer format.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function readAuthToken(req) {
  const authorizationHeader = req.headers.authorization || "";
  if (authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }
  return null;
}

/**
 * Express middleware — rejects requests without a valid session token.
 * On success, attaches the account object to req.account.
 *
 * @type {import('express').RequestHandler}
 */
function requireAuth(req, res, next) {
  const sessionToken = readAuthToken(req);
  const payload = verifySessionToken(sessionToken, config.SESSION_SECRET);

  if (!payload) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const account = getAccountById(payload.accountId);
  if (!account) {
    // The token is cryptographically valid but the account was deleted.
    res.status(401).json({ error: "Session is no longer valid." });
    return;
  }

  req.account = account;
  next();
}

module.exports = { readAuthToken, requireAuth };
