/**
 * Staff / admin-only endpoints.
 *
 *  POST /api/admin/send-checkin-emails
 *    Send (or resend) check-in QR emails to all approved guests.
 *    Pass { force: true } in the body to resend to guests who already
 *    received one; omit it to skip those guests.
 */

const { Router } = require("express");

const { getStore, persistStore } = require("../store");
const { sendRegistrationEmail } = require("../services/emailService");

const router = Router();

router.post("/api/admin/send-checkin-emails", async (req, res) => {
  const force = Boolean(req.body?.force);

  const approvedGuests = getStore().guests.filter(
    (g) => !g.archived && g.approvalStatus === "approved",
  );

  const results = [];

  // Send sequentially to avoid overwhelming the mail server.
  for (const guest of approvedGuests) {
    try {
      const result = await sendRegistrationEmail(guest, force);
      results.push({ guestId: guest.guestId, email: guest.email, ...result });
    } catch (error) {
      console.error(`Failed to send check-in email to ${guest.email}:`, error);
      results.push({
        guestId: guest.guestId,
        email: guest.email,
        failed: true,
        error: error.message,
      });
    }
  }

  persistStore();

  const sent = results.filter((r) => !r.skipped && !r.failed).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.failed).length;

  if (failed) {
    const failureSummary = results
      .filter((r) => r.failed)
      .map((r) => `${r.email}: ${r.error}`)
      .join(" | ");

    res.status(502).json({
      error: "Some check-in emails could not be sent.",
      details: failureSummary,
      sent,
      skipped,
      failed,
      results,
    });
    return;
  }

  res.json({ success: true, sent, skipped, failed: 0, results });
});

module.exports = router;
