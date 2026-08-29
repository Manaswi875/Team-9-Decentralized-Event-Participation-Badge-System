/**
 * Business logic specific to the Luma.co Chrome-extension integration.
 *
 *  • Derive a display name from an email address when no name is provided
 *  • Keep store.event in sync with the event context received from the extension
 *  • Upsert guest records from Luma attendee payloads (create-or-update semantics)
 */

const { getStore } = require("../store");
const {
  getEvent,
  sanitizeEventId,
  normalizeIncomingEventId,
} = require("../helpers/eventHelpers");
const { getGuestEventId } = require("./guestService");
const {
  createToken,
  createCheckInCode,
  createId,
  normalizeEmail,
} = require("../lib/security");
const { buildCheckInPayload } = require("../lib/storage");
const config = require("../lib/config");

/**
 * Produce a human-readable display name from an email address by splitting
 * the local-part on common separators (dot, underscore, plus, hyphen).
 *
 * Examples
 *   john.doe@example.com  → "John Doe"
 *   jsmith@example.com    → "Jsmith"
 *   @example.com          → "Guest"
 *
 * @param {string} email
 * @returns {string}
 */
function deriveAttendeeNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const segments = localPart
    .split(/[._+-]+/)
    .map((seg) => seg.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .slice(0, 3);

  if (!segments.length) return "Guest";

  return segments
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(" ");
}

/**
 * Update (or initialize) the store's active event using metadata received
 * from the Luma extension.  This is called once per extension push so the
 * dashboard always reflects the latest event context.
 *
 * @param {object} [eventContext={}]
 * @param {string} [eventContext.eventId]
 * @param {string} [eventContext.eventName]
 * @param {string} [eventContext.sourceUrl]
 * @returns {object} The updated event record stored in store.event
 */
function buildExtensionEventState(eventContext = {}) {
  const store = getStore();
  const fallbackEvent = getEvent();

  const eventId =
    normalizeIncomingEventId(eventContext.eventId, fallbackEvent.id) ||
    sanitizeEventId(eventContext.eventId) ||
    sanitizeEventId(config.EVENT_ID_OVERRIDE) ||
    sanitizeEventId(fallbackEvent.id) ||
    "badge-pop-event";

  // Prefer the extension-provided name; skip it if it looks like a generic slug.
  const isGenericSlug =
    !eventContext.eventId ||
    normalizeIncomingEventId(eventContext.eventId, "") === "";
  const eventName =
    (isGenericSlug ? "" : String(eventContext.eventName || "").trim()) ||
    String(eventContext.eventName || "").trim() ||
    config.EVENT_NAME_OVERRIDE ||
    fallbackEvent.name ||
    "Badge Pop Event";

  store.event = {
    id: eventId,
    name: eventName,
    sourceFile:
      eventContext.sourceUrl || fallbackEvent.sourceFile || "luma-extension",
    importedAt: new Date().toISOString(),
    guestCount: store.guests.filter((g) => !g.archived).length,
  };

  return store.event;
}

/**
 * Create or update a guest record from a Luma attendee payload.
 *
 * Lookup order
 *  1. Match on the composite externalRegistrationKey (luma:<eventId>:<email>)
 *  2. Match on (email, eventId) for records imported before the key was added
 *
 * @param {object} params
 * @param {object} params.attendee     - Luma attendee fields
 * @param {object} [params.eventContext={}]
 * @returns {{ guest: object, created: boolean }}
 */
function upsertLumaGuest({ attendee, eventContext = {} }) {
  const store = getStore();
  const normalizedEmail = normalizeEmail(attendee.email);
  const normalizedEventId =
    normalizeIncomingEventId(eventContext.eventId, getEvent().id) ||
    sanitizeEventId(eventContext.eventId) ||
    sanitizeEventId(getEvent().id) ||
    "badge-pop-event";

  const externalRegistrationKey = `luma:${normalizedEventId}:${normalizedEmail}`;
  const now = new Date().toISOString();

  // Try to find an existing non-archived guest for this registration.
  let guest = store.guests.find(
    (candidate) =>
      !candidate.archived &&
      (candidate.externalRegistrationKey === externalRegistrationKey ||
        (normalizeEmail(candidate.email) === normalizedEmail &&
          getGuestEventId(candidate) === normalizedEventId)),
  );

  const created = !guest;

  if (!guest) {
    // First time we've seen this attendee — create a full guest record.
    const checkInToken = createToken(12);
    const claimToken = createToken(12);
    const checkInCode = createCheckInCode();

    guest = {
      guestId: createId("gst"),
      name: attendee.name,
      firstName: attendee.firstName || attendee.name,
      lastName: attendee.lastName || "",
      email: normalizedEmail,
      phoneNumber: attendee.phoneNumber || "",
      createdAt: attendee.registeredAt || now,
      approvalStatus: "approved",
      originalCheckedInAt: null,
      originalQrCodeUrl: eventContext.sourceUrl || null,
      ticketTypeId: attendee.ticketTypeId || null,
      ticketName: attendee.ticketName || "Luma Registration",
      amount: attendee.amount || null,
      currency: attendee.currency || null,
      ethAddress: null,
      solanaAddress: null,
      archived: false,
      checkInToken,
      claimToken,
      checkInCode,
      checkInPayload: buildCheckInPayload(checkInToken),
      importedAt: now,
      registrationEmailSentAt: null,
      claimEmailSentAt: null,
      checkedInAt: null,
      claim: null,
      sourceEventId: normalizedEventId,
      sourceEventName:
        String(eventContext.eventName || "").trim() || getEvent().name,
      externalRegistrationKey,
      source: "luma-extension",
    };

    store.guests.unshift(guest);
  } else {
    // Update mutable fields; preserve tokens and check-in/claim timestamps.
    guest.name = attendee.name || guest.name;
    guest.firstName = attendee.firstName || guest.firstName;
    guest.lastName = attendee.lastName ?? guest.lastName;
    guest.email = normalizedEmail;
    guest.phoneNumber = attendee.phoneNumber || guest.phoneNumber || "";
    guest.approvalStatus = "approved";
    guest.archived = false;
    guest.originalQrCodeUrl =
      eventContext.sourceUrl || guest.originalQrCodeUrl || null;
    guest.ticketName =
      attendee.ticketName || guest.ticketName || "Luma Registration";
    guest.ticketTypeId = attendee.ticketTypeId || guest.ticketTypeId || null;
    guest.amount = attendee.amount || guest.amount || null;
    guest.currency = attendee.currency || guest.currency || null;
    guest.sourceEventId = normalizedEventId;
    guest.sourceEventName =
      String(eventContext.eventName || "").trim() ||
      guest.sourceEventName ||
      getEvent().name;
    guest.externalRegistrationKey = externalRegistrationKey;
    guest.importedAt = now;
    guest.createdAt = guest.createdAt || attendee.registeredAt || now;

    // Ensure tokens are present even on legacy records that lacked them.
    guest.checkInToken = guest.checkInToken || createToken(12);
    guest.claimToken = guest.claimToken || createToken(12);
    guest.checkInCode = guest.checkInCode || createCheckInCode();
    guest.checkInPayload = buildCheckInPayload(guest.checkInToken);
  }

  // Keep the event's guestCount in sync.
  if (store.event) {
    store.event.guestCount = store.guests.filter((g) => !g.archived).length;
  }

  return { guest, created };
}

module.exports = {
  deriveAttendeeNameFromEmail,
  buildExtensionEventState,
  upsertLumaGuest,
};
