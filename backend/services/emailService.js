/**
 * Orchestrates email delivery for the two transactional email types:
 *
 *  1. Registration / check-in QR  – sent when a guest is imported
 *  2. Claim-ready                 – sent after a guest is checked in at the venue
 */

const QRCode = require("qrcode");

const mailer = require("../mailerInstance");
const { getStore } = require("../store");
const {
  buildCheckInEmail,
  buildClaimEmail,
} = require("../helpers/emailBuilders");
const { buildPublicClaimUrl } = require("../helpers/urlHelpers");
const { logServer } = require("../logger");

/**
 * Send the check-in QR code email to a guest.
 *
 * The email is skipped when it has already been sent (registrationEmailSentAt
 * is set), unless force=true is passed — useful for resending after re-import.
 *
 * @param {object}  guest
 * @param {boolean} [force=false] - Resend even if already delivered
 * @returns {Promise<{ skipped: boolean, reason?: string }>}
 */
async function sendRegistrationEmail(guest, force = false) {
  logServer("email.registration.requested", {
    guestId: guest.guestId,
    email: guest.email,
    sourceEventId: guest.sourceEventId,
    sourceEventName: guest.sourceEventName,
    force,
    alreadySent: Boolean(guest.registrationEmailSentAt),
  });

  if (guest.registrationEmailSentAt && !force) {
    logServer("email.registration.skipped", {
      guestId: guest.guestId,
      email: guest.email,
      reason: "already-sent",
    });
    return { skipped: true, reason: "already-sent" };
  }

  // Render the QR code as a PNG buffer for both the SMTP attachment and the
  // inline data-URI used in the file-preview version of the email.
  const qrBuffer = await QRCode.toBuffer(guest.checkInPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: "#10231d", light: "#fffdf7" },
  });
  const qrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;

  // Build two variants: preview uses an inline data-URI; SMTP uses a CID reference
  // so the image is attached as an embedded attachment rather than hotlinked.
  const previewEmail = buildCheckInEmail({ guest, qrSrc: qrDataUrl });
  const smtpEmail = buildCheckInEmail({ guest, qrSrc: "cid:checkin-qr" });

  await mailer.sendEmail(getStore(), {
    ...smtpEmail,
    type: "registration-check-in",
    guestId: guest.guestId,
    to: guest.email,
    previewHtml: previewEmail.html,
    attachments: [
      {
        filename: `${guest.guestId}-checkin.png`,
        content: qrBuffer,
        cid: "checkin-qr",
      },
    ],
  });

  guest.registrationEmailSentAt = new Date().toISOString();
  logServer("email.registration.sent", {
    guestId: guest.guestId,
    email: guest.email,
    sentAt: guest.registrationEmailSentAt,
    deliveryMode: mailer.deliveryMode,
  });

  return { skipped: false };
}

/**
 * Send the "your badge is ready to claim" email after a guest checks in.
 *
 * De-duplicated by claimEmailSentAt — the email is only ever sent once per
 * claim cycle.  The claim URL is always returned so callers can surface it
 * in the API response regardless of whether the email was sent.
 *
 * @param {object} guest
 * @returns {Promise<{ skipped: boolean, claimUrl: string }>}
 */
async function sendClaimReadyEmail(guest) {
  const claimUrl = buildPublicClaimUrl(guest);

  logServer("email.claim.requested", {
    guestId: guest.guestId,
    email: guest.email,
    sourceEventId: guest.sourceEventId,
    sourceEventName: guest.sourceEventName,
    alreadySent: Boolean(guest.claimEmailSentAt),
  });

  if (guest.claimEmailSentAt) {
    logServer("email.claim.skipped", {
      guestId: guest.guestId,
      email: guest.email,
      reason: "already-sent",
    });
    return { skipped: true, claimUrl };
  }

  const email = buildClaimEmail(guest, claimUrl);
  await mailer.sendEmail(getStore(), {
    ...email,
    type: "claim-ready",
    guestId: guest.guestId,
    to: guest.email,
    previewHtml: email.html,
  });

  guest.claimEmailSentAt = new Date().toISOString();
  logServer("email.claim.sent", {
    guestId: guest.guestId,
    email: guest.email,
    sentAt: guest.claimEmailSentAt,
    deliveryMode: mailer.deliveryMode,
  });

  return { skipped: false, claimUrl };
}

module.exports = { sendRegistrationEmail, sendClaimReadyEmail };
