/**
 *  POST /api/integrations/luma/register
 *
 * Receives attendee payloads from the Badge Pop Chrome extension, which
 * scrapes the Luma event page and pushes each attendee to this endpoint.
 *
 * Flow
 *  1. Validate and normalize the incoming attendee payload
 *  2. Sync the active event in the store with the extension's event context
 *  3. Upsert the guest record (create or update)
 *  4. Send (or re-send) the check-in QR email
 *  5. Return the guest summary and a QR image URL for the extension UI
 */

const { Router } = require("express");

const { persistStore } = require("../../store");
const { normalizeEmail } = require("../../lib/security");
const { logServer } = require("../../logger");
const mailer = require("../../mailerInstance");
const {
  deriveAttendeeNameFromEmail,
  buildExtensionEventState,
  upsertLumaGuest,
} = require("../../services/lumaService");
const {
  getGuestEventId,
  summarizeGuest,
} = require("../../services/guestService");
const { sendRegistrationEmail } = require("../../services/emailService");
const {
  getEvent,
  normalizeIncomingEventId,
  sanitizeEventId,
} = require("../../helpers/eventHelpers");

const router = Router();

router.post("/api/integrations/luma/register", async (req, res) => {
  const attendee = req.body?.attendee || {};
  const eventContext = req.body?.eventContext || {};
  const normalizedEmail = normalizeEmail(attendee.email);

  logServer("luma.register.received", {
    email: normalizedEmail || attendee.email || null,
    attendeeName:
      attendee.name ||
      [attendee.firstName, attendee.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      null,
    eventId: eventContext.eventId || null,
    eventName: eventContext.eventName || null,
    sourceUrl: eventContext.sourceUrl || null,
  });

  // Derive a display name from the email when the extension didn't capture one.
  const attendeeName =
    String(attendee.name || "").trim() ||
    [attendee.firstName, attendee.lastName].filter(Boolean).join(" ").trim() ||
    deriveAttendeeNameFromEmail(normalizedEmail);

  if (!normalizedEmail) {
    logServer("luma.register.rejected", { reason: "missing-email" });
    res.status(400).json({ error: "Attendee email is required." });
    return;
  }

  // Update store.event from the extension's event context before any guest work.
  buildExtensionEventState(eventContext);

  // Check for a pre-existing guest so we can report alreadyRegistered accurately.
  const eventIdForLookup =
    normalizeIncomingEventId(eventContext.eventId, getEvent().id) ||
    sanitizeEventId(getEvent().id) ||
    "badge-pop-event";

  const { getStore } = require("../../store");
  const existingGuest = getStore().guests.find(
    (candidate) =>
      !candidate.archived &&
      normalizeEmail(candidate.email) === normalizedEmail &&
      getGuestEventId(candidate) === eventIdForLookup,
  );

  const { guest, created } = upsertLumaGuest({
    attendee: {
      ...attendee,
      email: normalizedEmail,
      name: attendeeName,
      firstName:
        String(attendee.firstName || "").trim() ||
        attendeeName.split(/\s+/)[0] ||
        attendeeName,
      lastName:
        String(attendee.lastName || "").trim() ||
        attendeeName.split(/\s+/).slice(1).join(" ").trim(),
    },
    eventContext,
  });

  logServer("luma.register.upserted", {
    guestId: guest.guestId,
    email: guest.email,
    eventId: getGuestEventId(guest),
    sourceEventName: guest.sourceEventName,
    created,
    alreadyRegistered: Boolean(existingGuest),
    checkInCode: guest.checkInCode,
  });

  // Always force-resend so each Luma confirmation produces a fresh QR email.
  let registrationResult;
  try {
    registrationResult = await sendRegistrationEmail(guest, /* force */ true);
  } catch (error) {
    logServer("luma.register.email_failed", {
      guestId: guest.guestId,
      email: guest.email,
      error: error.message,
    });
    persistStore();
    res.status(502).json({
      error:
        "Guest registration was captured, but the check-in email could not be sent.",
      details: error.message,
      guest: summarizeGuest(guest),
    });
    return;
  }

  persistStore();
  logServer("luma.register.completed", {
    guestId: guest.guestId,
    email: guest.email,
    emailSent: !registrationResult.skipped,
    deliveryMode: mailer.deliveryMode,
  });

  res.json({
    success: true,
    event: getEvent(),
    guest: summarizeGuest(guest),
    deliveryMode: mailer.deliveryMode,
    emailSent: !registrationResult.skipped,
    alreadyRegistered: Boolean(existingGuest),
    checkInCode: guest.checkInCode,
    qrImageUrl: `/api/qr/${encodeURIComponent(guest.guestId)}`,
  });
});

module.exports = router;
