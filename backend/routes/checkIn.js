/**
 * POST /api/check-in/scan
 *
 * Called by the staff check-in app whenever a QR code or manual fallback
 * code is scanned at the venue.  On success the guest is marked as
 * checked-in and a claim-ready email is dispatched automatically.
 */

const { Router } = require("express");

const { persistStore } = require("../store");
const { parseScannedValue } = require("../helpers/scanParser");
const { logServer } = require("../logger");
const {
  getGuestByCheckInToken,
  getGuestByCheckInCode,
  summarizeGuest,
} = require("../services/guestService");
const { sendClaimReadyEmail } = require("../services/emailService");

const router = Router();

router.post("/api/check-in/scan", async (req, res) => {
  const parsed = parseScannedValue(req.body?.scanData);
  logServer("checkin.scan.received", {
    scanType: parsed?.type || null,
    rawProvided: Boolean(req.body?.scanData),
  });

  if (!parsed) {
    res.status(400).json({ error: "Provide QR scan data or a fallback code." });
    return;
  }

  // Resolve the guest via token (QR scan) or human-readable code (manual entry).
  const guest =
    parsed.type === "token"
      ? getGuestByCheckInToken(parsed.value)
      : getGuestByCheckInCode(parsed.value);

  if (!guest) {
    logServer("checkin.scan.not_found", {
      scanType: parsed.type,
      value: parsed.value,
    });
    res.status(404).json({ error: "No guest matches that QR code." });
    return;
  }

  if (guest.approvalStatus !== "approved") {
    res.status(409).json({
      error: "This registration is not approved for check-in yet.",
      guest: summarizeGuest(guest),
    });
    return;
  }

  // Allow re-scanning without overwriting the original check-in timestamp.
  const alreadyCheckedIn = Boolean(guest.checkedInAt);
  if (!alreadyCheckedIn) {
    guest.checkedInAt = new Date().toISOString();
  }
  logServer("checkin.scan.matched", {
    guestId: guest.guestId,
    email: guest.email,
    alreadyCheckedIn,
    checkedInAt: guest.checkedInAt,
  });

  // Send the badge claim email (idempotent — the service skips duplicates).
  let claimEmailResult;
  try {
    claimEmailResult = await sendClaimReadyEmail(guest);
  } catch (error) {
    logServer("checkin.scan.claim_email_failed", {
      guestId: guest.guestId,
      email: guest.email,
      error: error.message,
    });
    // Persist the check-in even if the email failed so we don't lose the timestamp.
    persistStore();
    res.status(500).json({
      error: "Guest was checked in, but the claim email could not be sent.",
      details: error.message,
      guest: summarizeGuest(guest),
    });
    return;
  }

  persistStore();
  logServer("checkin.scan.completed", {
    guestId: guest.guestId,
    email: guest.email,
    claimEmailSent: !claimEmailResult.skipped,
    claimUrl: claimEmailResult.claimUrl,
  });

  res.json({
    success: true,
    alreadyCheckedIn,
    claimEmailSent: !claimEmailResult.skipped,
    claimUrl: claimEmailResult.claimUrl,
    guest: summarizeGuest(guest),
  });
});

module.exports = router;
