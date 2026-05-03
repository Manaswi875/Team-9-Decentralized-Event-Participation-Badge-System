/**
 * Pure utility functions for working with event identifiers and the
 * current event stored in the data store.
 */

const config = require("../lib/config");
const { getStore } = require("../store");

/**
 * Return the active event object from the store, or a safe default when
 * no event has been imported yet.
 *
 * @returns {{ id: string, name: string, sourceFile: string|null, importedAt: string|null, guestCount: number }}
 */
function getEvent() {
  const store = getStore();
  return (
    store.event || {
      id: config.EVENT_ID_OVERRIDE || "badge-pop-event",
      name: config.EVENT_NAME_OVERRIDE || "Badge Pop Event",
      sourceFile: null,
      importedAt: null,
      guestCount: 0,
    }
  );
}

/**
 * Convert an arbitrary string into a URL-safe event identifier.
 * Strips leading/trailing hyphens and limits length to 64 characters.
 *
 * @param {string} value
 * @returns {string}
 */
function sanitizeEventId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Return true when the supplied eventId looks like a generic Luma navigation
 * page rather than a real event (e.g. "luma-home", "luma-events").
 *
 * @param {string} eventId - Already-sanitized event ID
 * @returns {boolean}
 */
function isGenericLumaEventId(eventId) {
  return /^luma-(home|discover|events?|calendar|calendars|settings|notifications)$/.test(
    sanitizeEventId(eventId),
  );
}

/**
 * Normalize an incoming event ID from an external source (e.g. the Luma
 * Chrome extension).  Falls back to fallbackEventId when the supplied value
 * is empty or a known generic Luma page slug.
 *
 * @param {string} eventId
 * @param {string} [fallbackEventId=""]
 * @returns {string}
 */
function normalizeIncomingEventId(eventId, fallbackEventId = "") {
  const sanitizedEventId = sanitizeEventId(eventId);
  if (!sanitizedEventId || isGenericLumaEventId(sanitizedEventId)) {
    return sanitizeEventId(fallbackEventId) || "";
  }
  return sanitizedEventId;
}

module.exports = {
  getEvent,
  sanitizeEventId,
  isGenericLumaEventId,
  normalizeIncomingEventId,
};
