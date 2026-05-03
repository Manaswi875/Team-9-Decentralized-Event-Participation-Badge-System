/**
 * Pure functions that return { subject, html, text } email payloads.
 * These builders have no side-effects; the actual sending is handled by
 * emailService.js.
 */

/**
 * Build the check-in QR email sent to a guest after they register.
 *
 * @param {object} params
 * @param {object} params.guest        - Guest record
 * @param {string} params.qrSrc        - Image src (data-URI for preview, "cid:…" for SMTP)
 * @param {string|null} [params.claimUrl] - If the guest is already checked in, include a claim link
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildCheckInEmail({ guest, qrSrc, claimUrl = null }) {
  // Use the source event metadata stored on the guest, not the global event,
  // so that multi-event imports display the correct event name.
  const event = {
    id: guest.sourceEventId,
    name: guest.sourceEventName,
  };

  // Inline callout differs depending on whether the guest is already checked in.
  const callout = claimUrl
    ? `<p style="margin:16px 0 0;color:#0f5b52;">Already checked in? Claim your badge here: <a href="${claimUrl}" style="color:#0f5b52;">${claimUrl}</a></p>`
    : `<p style="margin:16px 0 0;color:#666;">Once your QR is scanned at the venue, we will email your badge claim link automatically.</p>`;

  const html = `
    <div style="background:#f5f1e8;padding:32px;font-family:'Avenir Next',Segoe UI,sans-serif;color:#10231d;">
      <div style="max-width:620px;margin:0 auto;background:#fffdf7;border-radius:28px;padding:36px;box-shadow:0 20px 60px rgba(14,34,28,0.12);border:1px solid rgba(16,35,29,0.08);">
        <p style="letter-spacing:0.24em;font-size:11px;text-transform:uppercase;color:#8b5e34;margin:0 0 18px;">Event Check-In QR</p>
        <h1 style="font-family:'Iowan Old Style','Palatino Linotype',serif;font-size:38px;line-height:1.05;margin:0 0 10px;">${
          event.name
        }</h1>
        <p style="font-size:18px;line-height:1.6;margin:0 0 24px;">Hi ${
          guest.firstName || guest.name
        }, bring this QR code to the event check-in desk. It is tied to your registration and unlocks your on-chain attendance badge after you arrive.</p>
        <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;background:#faf5eb;border-radius:22px;padding:22px;">
          <img src="${qrSrc}" alt="Check-in QR code" style="width:220px;height:220px;border-radius:18px;background:#fff;padding:14px;display:block;" />
          <div style="flex:1;min-width:200px;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#8b5e34;">Fallback Code</p>
            <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:0.06em;">${
              guest.checkInCode
            }</p>
            <p style="margin:0 0 8px;color:#444;">Ticket: <strong>${
              guest.ticketName || "General Admission"
            }</strong></p>
            <p style="margin:0;color:#444;">Email: <strong>${
              guest.email
            }</strong></p>
          </div>
        </div>
        ${callout}
      </div>
    </div>
  `;

  const text = [
    `${event.name}`,
    "",
    `Hi ${guest.firstName || guest.name},`,
    "Use your attached QR code or the fallback code below at the check-in desk.",
    "",
    `Fallback code: ${guest.checkInCode}`,
    claimUrl
      ? `Claim link: ${claimUrl}`
      : "We will email your claim link after you check in.",
  ].join("\n");

  return {
    subject: `${event.name}: your event check-in QR code`,
    html,
    text,
  };
}

/**
 * Build the "badge ready to claim" email sent after a guest is checked in.
 *
 * @param {object} guest  - Guest record (must have claimToken, firstName/name, email)
 * @param {string} claimUrl - Full public claim URL
 * @returns {{ subject: string, html: string, text: string, claimUrl: string }}
 */
function buildClaimEmail(guest, claimUrl) {
  const event = {
    id: guest.sourceEventId,
    name: guest.sourceEventName,
  };

  const html = `
    <div style="background:#0f1f19;padding:32px;font-family:'Avenir Next',Segoe UI,sans-serif;color:#f7f2e8;">
      <div style="max-width:620px;margin:0 auto;background:linear-gradient(180deg,#17332a 0%,#0f1f19 100%);border-radius:28px;padding:36px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 30px 80px rgba(0,0,0,0.35);">
        <p style="letter-spacing:0.24em;font-size:11px;text-transform:uppercase;color:#d8ab61;margin:0 0 18px;">Badge Ready</p>
        <h1 style="font-family:'Iowan Old Style','Palatino Linotype',serif;font-size:38px;line-height:1.05;margin:0 0 14px;">You checked in to ${event.name}</h1>
        <p style="font-size:18px;line-height:1.6;margin:0 0 24px;color:#d8e2db;">Your attendance is now verified. Sign in or create your platform account to receive a wallet address and mint your soulbound badge to it.</p>
        <a href="${claimUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#f0b45f;color:#10231d;text-decoration:none;font-weight:700;">Claim your blockchain badge</a>
        <p style="margin:24px 0 0;color:#c5d0c9;line-height:1.7;">This badge is minted as a non-transferable token, so anyone can verify your attendance on-chain without needing to ask the event organizer.</p>
        <p style="margin:18px 0 0;color:#8fa19a;font-size:13px;word-break:break-word;">Claim link: ${claimUrl}</p>
      </div>
    </div>
  `;

  const text = [
    `${event.name}: your attendance badge is ready`,
    "",
    `Hi ${guest.firstName || guest.name},`,
    "You have been checked in successfully.",
    `Claim your badge here: ${claimUrl}`,
  ].join("\n");

  return {
    subject: `${event.name}: claim your blockchain attendance badge`,
    html,
    text,
    claimUrl,
  };
}

module.exports = { buildCheckInEmail, buildClaimEmail };
