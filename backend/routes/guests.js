/**
 * Guest-facing read endpoints:
 *  GET /api/guests        – Full alphabetically-sorted guest list (staff use)
 *  GET /api/qr/:guestId   – Render a guest's check-in QR code as a PNG image
 */

const { Router } = require("express");
const QRCode = require("qrcode");

const { getStore } = require("../store");
const { getEvent } = require("../helpers/eventHelpers");
const { getGuestById, summarizeGuest } = require("../services/guestService");

const router = Router();

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
