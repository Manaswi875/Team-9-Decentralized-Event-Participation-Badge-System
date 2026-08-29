/**
 * All read/write operations against the guest collection in the store.
 * Route handlers and other services should always go through these
 * functions rather than accessing store.guests directly, which keeps
 * mutation logic in one place.
 */

const { getStore } = require("../store");
const {
  getEvent,
  normalizeIncomingEventId,
} = require("../helpers/eventHelpers");
const { serializeGuestForClient } = require("../lib/storage");
const { normalizeEmail } = require("../lib/security");

/**
 * Return the event ID that this guest belongs to.
 * Falls back to the current global event when the guest has no sourceEventId.
 *
 * @param {object} guest
 * @returns {string}
 */
function getGuestEventId(guest) {
  return guest.sourceEventId || getEvent().id;
}

/**
 * Return the event name that this guest belongs to.
 * Falls back to the current global event name.
 *
 * @param {object} guest
 * @returns {string}
 */
function getGuestEventName(guest) {
  return guest.sourceEventName || getEvent().name;
}

/** @param {string} guestId */
function getGuestById(guestId) {
  return getStore().guests.find((g) => g.guestId === guestId);
}

/** @param {string} claimToken */
function getGuestByClaimToken(claimToken) {
  return getStore().guests.find((g) => g.claimToken === claimToken);
}

/** @param {string} checkInToken */
function getGuestByCheckInToken(checkInToken) {
  return getStore().guests.find((g) => g.checkInToken === checkInToken);
}

/** @param {string} checkInCode */
function getGuestByCheckInCode(checkInCode) {
  return getStore().guests.find((g) => g.checkInCode === checkInCode);
}

/**
 * Serialize a guest into the trimmed shape that is safe to return to clients.
 * Strips internal tokens and other private fields via serializeGuestForClient.
 *
 * @param {object} guest
 * @returns {object}
 */
function summarizeGuest(guest) {
  return serializeGuestForClient(guest, getGuestEventId(guest));
}

/**
 * Find the most recently imported non-archived guest whose email matches
 * the given account.  Used to link an account to its check-in record.
 *
 * @param {{ email: string }} account
 * @returns {object|undefined}
 */
function getGuestForAccount(account) {
  return getStore()
    .guests.filter(
      (guest) =>
        normalizeEmail(guest.email) === account.email && !guest.archived,
    )
    .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt))[0];
}

module.exports = {
  getGuestEventId,
  getGuestEventName,
  getGuestById,
  getGuestByClaimToken,
  getGuestByCheckInToken,
  getGuestByCheckInCode,
  summarizeGuest,
  getGuestForAccount,
};
