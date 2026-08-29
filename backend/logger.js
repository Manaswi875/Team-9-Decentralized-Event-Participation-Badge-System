/**
 * Centralized structured logging utility.
 * All server events are emitted through this single function so that
 * log format is consistent across every module.
 */

/**
 * Emit a structured log line with an ISO timestamp.
 *
 * @param {string} event  - Dot-separated event name, e.g. "email.claim.sent"
 * @param {object} details - Optional key/value payload printed as JSON
 */
function logServer(event, details = {}) {
  const timestamp = new Date().toISOString();
  const suffix =
    details && Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] ${event}${suffix}`);
}

module.exports = { logServer };
