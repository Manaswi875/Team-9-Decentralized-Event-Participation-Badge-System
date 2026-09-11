/**
 * Guest-facing read endpoints:
 *  GET  /api/guests               – Full alphabetically-sorted guest list (staff use)
 *  GET  /api/qr/:guestId          – Render a guest's check-in QR code as a PNG image
 *  POST /api/guests/self-register – Public self-serve registration (skips Luma + the
 *                                    Chrome extension, for testing the flow directly)
 */

const { Router } = require("express");
const QRCode = require("qrcode");

const { getStore, persistStore } = require("../store");
const { getEvent } = require("../helpers/eventHelpers");
const { getGuestById, summarizeGuest } = require("../services/guestService");
const { normalizeEmail } = require("../lib/security");
const { upsertLumaGuest } = require("../services/lumaService");
const { sendRegistrationEmail } = require("../services/emailService");
const { logServer } = require("../logger");

const router = Router();

router.post("/api/guests/self-register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();

  if (!email || !name) {
    res.status(400).json({ error: "Name and email are required." });
    return;
  }

  const { guest, created } = upsertLumaGuest({
    attendee: { email, name, ticketName: "Public Registration" },
    eventContext: {},
    source: "public-form",
  });

  logServer("selfregister.upserted", { guestId: guest.guestId, email: guest.email, created });

  let registrationResult;
  try {
    registrationResult = await sendRegistrationEmail(guest, /* force */ true);
  } catch (error) {
    logServer("selfregister.email_failed", { guestId: guest.guestId, error: error.message });
    persistStore();
    res.status(502).json({
      error: "Registration was saved, but the check-in email could not be sent.",
      details: error.message,
      guest: summarizeGuest(guest),
    });
    return;
  }

  persistStore();
  res.json({
    success: true,
    guest: summarizeGuest(guest),
    checkInCode: guest.checkInCode,
    emailSent: !registrationResult.skipped,
  });
});

router.get("/api/guests", (_req, res) => {
  const guests = getStore()
    .guests.filter((g) => !g.archived)
    .map(summarizeGuest)
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ event: getEvent(), guests });
});

router.get("/api/qr/:guestId", async (req, res) => {
  const guest = getGuestById(req.params.guestId);
  if (!guest) {
    res.status(404).json({ error: "Guest not found." });
    return;
  }

  const pngBuffer = await QRCode.toBuffer(guest.checkInPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: "#10231d", light: "#fffdf7" },
  });

  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
});

module.exports = router;
