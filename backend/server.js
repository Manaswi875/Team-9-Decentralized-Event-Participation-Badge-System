const fs = require("fs");
const path = require("path");

const cors = require("cors");
const express = require("express");
const { ethers } = require("ethers");
const QRCode = require("qrcode");

const config = require("./lib/config");
const { burnBadge, isChainConfigured, mintBadge, verifyBadge } = require("./lib/blockchain");
const { createMailer } = require("./lib/mailer");
const {
  createCheckInCode,
  createToken,
  createId,
  createSessionToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
  verifySessionToken,
} = require("./lib/security");
const {
  buildCheckInPayload,
  ensureDirectory,
  loadStore,
  saveStore,
  serializeGuestForClient,
} = require("./lib/storage");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

ensureDirectory(config.DATA_DIR);
ensureDirectory(config.EMAIL_PREVIEW_DIR);

let store = loadStore(config.STORE_FILE);

function logServer(event, details = {}) {
  const timestamp = new Date().toISOString();
  const suffix = details && Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] ${event}${suffix}`);
}

const mailer = createMailer(config, {
  log: logServer,
});

function persistStore() {
  saveStore(config.STORE_FILE, store);
}

function refreshStoreFromDisk() {
  store = loadStore(config.STORE_FILE);
  return store;
}

function getEvent() {
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

function sanitizeEventId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function isGenericLumaEventId(eventId) {
  return /^luma-(home|discover|events?|calendar|calendars|settings|notifications)$/.test(
    sanitizeEventId(eventId),
  );
}

function normalizeIncomingEventId(eventId, fallbackEventId = "") {
  const sanitizedEventId = sanitizeEventId(eventId);
  if (!sanitizedEventId || isGenericLumaEventId(sanitizedEventId)) {
    return sanitizeEventId(fallbackEventId) || "";
  }

  return sanitizedEventId;
}

function getGuestEventId(guest) {
  return guest.sourceEventId || getEvent().id;
}

function getGuestEventName(guest) {
  return guest.sourceEventName || getEvent().name;
}

function deriveAttendeeNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const segments = localPart
    .split(/[._+-]+/)
    .map((segment) => segment.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .slice(0, 3);

  if (!segments.length) {
    return "Guest";
  }

  return segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
}

function buildExtensionEventState(eventContext = {}) {
  const fallbackEvent = getEvent();
  const eventId =
    normalizeIncomingEventId(eventContext.eventId, fallbackEvent.id) ||
    sanitizeEventId(eventContext.eventId) ||
    sanitizeEventId(config.EVENT_ID_OVERRIDE) ||
    sanitizeEventId(fallbackEvent.id) ||
    "badge-pop-event";
  const eventName =
    (isGenericLumaEventId(eventContext.eventId) ? "" : String(eventContext.eventName || "").trim()) ||
    String(eventContext.eventName || "").trim() ||
    config.EVENT_NAME_OVERRIDE ||
    fallbackEvent.name ||
    "Badge Pop Event";

  store.event = {
    id: eventId,
    name: eventName,
    sourceFile: eventContext.sourceUrl || fallbackEvent.sourceFile || "luma-extension",
    importedAt: new Date().toISOString(),
    guestCount: store.guests.filter((guest) => !guest.archived).length,
  };

  return store.event;
}

function upsertLumaGuest({ attendee, eventContext = {} }) {
  const normalizedEmail = normalizeEmail(attendee.email);
  const normalizedEventId =
    normalizeIncomingEventId(eventContext.eventId, getEvent().id) ||
    sanitizeEventId(eventContext.eventId) ||
    sanitizeEventId(getEvent().id) ||
    "badge-pop-event";
  const externalRegistrationKey = `luma:${normalizedEventId}:${normalizedEmail}`;
  const now = new Date().toISOString();

  let guest = store.guests.find(
    (candidate) =>
      !candidate.archived &&
      (candidate.externalRegistrationKey === externalRegistrationKey ||
        (normalizeEmail(candidate.email) === normalizedEmail &&
          getGuestEventId(candidate) === normalizedEventId)),
  );
  const created = !guest;

  if (!guest) {
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
      sourceEventName: String(eventContext.eventName || "").trim() || getEvent().name,
      externalRegistrationKey,
      source: "luma-extension",
    };

    store.guests.unshift(guest);
  } else {
    guest.name = attendee.name || guest.name;
    guest.firstName = attendee.firstName || guest.firstName;
    guest.lastName = attendee.lastName ?? guest.lastName;
    guest.email = normalizedEmail;
    guest.phoneNumber = attendee.phoneNumber || guest.phoneNumber || "";
    guest.approvalStatus = "approved";
    guest.archived = false;
    guest.originalQrCodeUrl = eventContext.sourceUrl || guest.originalQrCodeUrl || null;
    guest.ticketName = attendee.ticketName || guest.ticketName || "Luma Registration";
    guest.ticketTypeId = attendee.ticketTypeId || guest.ticketTypeId || null;
    guest.amount = attendee.amount || guest.amount || null;
    guest.currency = attendee.currency || guest.currency || null;
    guest.sourceEventId = normalizedEventId;
    guest.sourceEventName =
      String(eventContext.eventName || "").trim() || guest.sourceEventName || getEvent().name;
    guest.externalRegistrationKey = externalRegistrationKey;
    guest.importedAt = now;
    guest.createdAt = guest.createdAt || attendee.registeredAt || now;
    guest.checkInToken = guest.checkInToken || createToken(12);
    guest.claimToken = guest.claimToken || createToken(12);
    guest.checkInCode = guest.checkInCode || createCheckInCode();
    guest.checkInPayload = buildCheckInPayload(guest.checkInToken);
  }

  if (store.event) {
    store.event.guestCount = store.guests.filter((candidate) => !candidate.archived).length;
  }

  return {
    guest,
    created,
  };
}

function getGuestById(guestId) {
  return store.guests.find((guest) => guest.guestId === guestId);
}

function getGuestByClaimToken(claimToken) {
  return store.guests.find((guest) => guest.claimToken === claimToken);
}

function getGuestByCheckInToken(checkInToken) {
  return store.guests.find((guest) => guest.checkInToken === checkInToken);
}

function getGuestByCheckInCode(checkInCode) {
  return store.guests.find((guest) => guest.checkInCode === checkInCode);
}

function getAccountById(accountId) {
  return store.accounts.find((account) => account.accountId === accountId);
}

function getAccountByEmail(email) {
  return store.accounts.find((account) => account.email === normalizeEmail(email));
}

function getGuestForAccount(account) {
  // Find the most recent non-archived guest matching this email
  return store.guests
    .filter((guest) => normalizeEmail(guest.email) === account.email && !guest.archived)
    .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt))[0];
}

function getBadgesForAccount(account) {
  return store.guests
    .filter((guest) => guest.claim?.walletAddress === account.walletAddress)
    .map((guest) => ({
      tokenId: guest.claim.tokenId,
      claimedAt: guest.claim.claimedAt,
      txHash: guest.claim.txHash,
      eventId: guest.claim.eventId,
      eventName: guest.claim.eventName || getEvent().name,
      verifyUrl: `/verify/${encodeURIComponent(guest.claim.tokenId)}`,
      contractAddress: guest.claim.contractAddress,
    }))
    .sort((left, right) => new Date(right.claimedAt) - new Date(left.claimedAt));
}

function buildPublicClaimUrl(guest) {
  return `${config.BASE_URL}/claim?token=${encodeURIComponent(guest.claimToken)}`;
}

function buildPublicVerifyUrl(tokenId) {
  return `${config.BASE_URL}/verify/${encodeURIComponent(tokenId)}`;
}

function summarizeGuest(guest) {
  return serializeGuestForClient(guest, getGuestEventId(guest));
}

function buildCheckInEmail({ guest, qrSrc, claimUrl = null }) {
  const event = {
    id: getGuestEventId(guest),
    name: getGuestEventName(guest),
  };
  const callout = claimUrl
    ? `<p style="margin:16px 0 0;color:#0f5b52;">Already checked in? Claim your badge here: <a href="${claimUrl}" style="color:#0f5b52;">${claimUrl}</a></p>`
    : `<p style="margin:16px 0 0;color:#666;">Once your QR is scanned at the venue, we will email your badge claim link automatically.</p>`;

  const html = `
    <div style="background:#f5f1e8;padding:32px;font-family:'Avenir Next',Segoe UI,sans-serif;color:#10231d;">
      <div style="max-width:620px;margin:0 auto;background:#fffdf7;border-radius:28px;padding:36px;box-shadow:0 20px 60px rgba(14,34,28,0.12);border:1px solid rgba(16,35,29,0.08);">
        <p style="letter-spacing:0.24em;font-size:11px;text-transform:uppercase;color:#8b5e34;margin:0 0 18px;">Event Check-In QR</p>
        <h1 style="font-family:'Iowan Old Style','Palatino Linotype',serif;font-size:38px;line-height:1.05;margin:0 0 10px;">${event.name}</h1>
        <p style="font-size:18px;line-height:1.6;margin:0 0 24px;">Hi ${guest.firstName || guest.name}, bring this QR code to the event check-in desk. It is tied to your registration and unlocks your on-chain attendance badge after you arrive.</p>
        <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;background:#faf5eb;border-radius:22px;padding:22px;">
          <img src="${qrSrc}" alt="Check-in QR code" style="width:220px;height:220px;border-radius:18px;background:#fff;padding:14px;display:block;" />
          <div style="flex:1;min-width:200px;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#8b5e34;">Fallback Code</p>
            <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:0.06em;">${guest.checkInCode}</p>
            <p style="margin:0 0 8px;color:#444;">Ticket: <strong>${guest.ticketName || "General Admission"}</strong></p>
            <p style="margin:0;color:#444;">Email: <strong>${guest.email}</strong></p>
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
    claimUrl ? `Claim link: ${claimUrl}` : "We will email your claim link after you check in.",
  ].join("\n");

  return {
    subject: `${event.name}: your event check-in QR code`,
    html,
    text,
  };
}

function buildClaimEmail(guest) {
  const event = {
    id: getGuestEventId(guest),
    name: getGuestEventName(guest),
  };
  const claimUrl = buildPublicClaimUrl(guest);
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

async function sendRegistrationEmail(guest, force = false) {
  logServer("email.registration.requested", {
    guestId: guest.guestId,
    email: guest.email,
    eventId: getGuestEventId(guest),
    eventName: getGuestEventName(guest),
    force,
    alreadySent: Boolean(guest.registrationEmailSentAt),
  });

  if (guest.registrationEmailSentAt && !force) {
    logServer("email.registration.skipped", {
      guestId: guest.guestId,
      email: guest.email,
      reason: "already-sent",
    });
    return {
      skipped: true,
      reason: "already-sent",
    };
  }

  const qrBuffer = await QRCode.toBuffer(guest.checkInPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: {
      dark: "#10231d",
      light: "#fffdf7",
    },
  });

  const qrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;

  const previewEmail = buildCheckInEmail({
    guest,
    qrSrc: qrDataUrl,
  });
  const smtpEmail = buildCheckInEmail({
    guest,
    qrSrc: "cid:checkin-qr",
  });

  await mailer.sendEmail(store, {
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
  return {
    skipped: false,
  };
}

async function sendClaimReadyEmail(guest) {
  logServer("email.claim.requested", {
    guestId: guest.guestId,
    email: guest.email,
    eventId: getGuestEventId(guest),
    eventName: getGuestEventName(guest),
    alreadySent: Boolean(guest.claimEmailSentAt),
  });

  if (guest.claimEmailSentAt) {
    logServer("email.claim.skipped", {
      guestId: guest.guestId,
      email: guest.email,
      reason: "already-sent",
    });
    return {
      skipped: true,
      claimUrl: buildPublicClaimUrl(guest),
    };
  }

  const email = buildClaimEmail(guest);
  await mailer.sendEmail(store, {
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
  return {
    skipped: false,
    claimUrl: email.claimUrl,
  };
}

function parseScannedValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }

  const customPrefix = "badgepop://check-in/";
  if (value.startsWith(customPrefix)) {
    return {
      type: "token",
      value: value.slice(customPrefix.length),
    };
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const checkInIndex = segments.indexOf("check-in");
    if (checkInIndex !== -1 && segments[checkInIndex + 1]) {
      return {
        type: "token",
        value: segments[checkInIndex + 1],
      };
    }

    if (url.searchParams.get("token")) {
      return {
        type: "token",
        value: url.searchParams.get("token"),
      };
    }
  } catch (error) {
    // Fall through to manual code handling.
  }

  return {
    type: "code",
    value: value.toUpperCase(),
  };
}

function readAuthToken(req) {
  const authorizationHeader = req.headers.authorization || "";
  if (authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  return null;
}

function requireAuth(req, res, next) {
  const sessionToken = readAuthToken(req);
  const payload = verifySessionToken(sessionToken, config.SESSION_SECRET);

  if (!payload) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const account = getAccountById(payload.accountId);
  if (!account) {
    res.status(401).json({ error: "Session is no longer valid." });
    return;
  }

  req.account = account;
  next();
}

function getAccountPayload(account) {
  const guest = getGuestForAccount(account);

  return {
    accountId: account.accountId,
    email: account.email,
    walletAddress: account.walletAddress,
    createdAt: account.createdAt,
    eligibleGuest: guest ? summarizeGuest(guest) : null,
    badges: getBadgesForAccount(account),
  };
}

app.use(express.static(config.PUBLIC_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "index.html"));
});

app.get("/staff", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "staff.html"));
});

app.get("/claim", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "claim.html"));
});

app.get("/verify", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "verify.html"));
});

app.get("/verify/:tokenId", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "verify.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    event: getEvent(),
    deliveryMode: mailer.deliveryMode,
    chainConfigured: isChainConfigured(config),
  });
});

app.get("/api/dashboard", (_req, res) => {
  const guests = store.guests.filter((guest) => !guest.archived);
  const checkedInCount = guests.filter((guest) => guest.checkedInAt).length;
  const claimedCount = guests.filter((guest) => guest.claim?.claimedAt).length;
  const registrationEmailCount = guests.filter((guest) => guest.registrationEmailSentAt).length;
  const claimEmailCount = guests.filter((guest) => guest.claimEmailSentAt).length;
  const recentCheckIns = guests
    .filter((guest) => guest.checkedInAt)
    .sort((left, right) => new Date(right.checkedInAt) - new Date(left.checkedInAt))
    .slice(0, 8)
    .map(summarizeGuest);

  res.json({
    event: getEvent(),
    platform: {
      baseUrl: config.BASE_URL,
      deliveryMode: mailer.deliveryMode,
      chainConfigured: isChainConfigured(config),
      contractAddress: config.CONTRACT_ADDRESS,
    },
    stats: {
      totalGuests: guests.length,
      approvedGuests: guests.filter((guest) => guest.approvalStatus === "approved").length,
      checkedInGuests: checkedInCount,
      claimableGuests: checkedInCount - claimedCount,
      claimedBadges: claimedCount,
      accountsCreated: store.accounts.length,
      registrationEmailCount,
      claimEmailCount,
    },
    recentCheckIns,
  });
});

app.get("/api/guests", (_req, res) => {
  const guests = store.guests
    .filter((guest) => !guest.archived)
    .map(summarizeGuest)
    .sort((left, right) => left.name.localeCompare(right.name));

  res.json({
    event: getEvent(),
    guests,
  });
});

app.post("/api/integrations/luma/register", async (req, res) => {
  const attendee = req.body?.attendee || {};
  const eventContext = req.body?.eventContext || {};
  const normalizedEmail = normalizeEmail(attendee.email);
  logServer("luma.register.received", {
    email: normalizedEmail || attendee.email || null,
    attendeeName:
      attendee.name ||
      [attendee.firstName, attendee.lastName].filter(Boolean).join(" ").trim() ||
      null,
    eventId: eventContext.eventId || null,
    eventName: eventContext.eventName || null,
    sourceUrl: eventContext.sourceUrl || null,
  });

  const attendeeName =
    String(attendee.name || "").trim() ||
    [attendee.firstName, attendee.lastName].filter(Boolean).join(" ").trim() ||
    deriveAttendeeNameFromEmail(normalizedEmail);

  if (!normalizedEmail) {
    logServer("luma.register.rejected", {
      reason: "missing-email",
    });
    res.status(400).json({ error: "Attendee email is required." });
    return;
  }

  buildExtensionEventState(eventContext);

  const eventIdForLookup =
    normalizeIncomingEventId(eventContext.eventId, getEvent().id) ||
    sanitizeEventId(getEvent().id) ||
    "badge-pop-event";
  const existingGuest = store.guests.find(
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
      firstName: String(attendee.firstName || "").trim() || attendeeName.split(/\s+/)[0] || attendeeName,
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
    eventName: getGuestEventName(guest),
    created,
    alreadyRegistered: Boolean(existingGuest),
    checkInCode: guest.checkInCode,
  });

  let registrationResult;
  try {
    // Each Luma confirmation should create/send a fresh check-in QR email.
    registrationResult = await sendRegistrationEmail(guest, true);
  } catch (error) {
    logServer("luma.register.email_failed", {
      guestId: guest.guestId,
      email: guest.email,
      error: error.message,
    });
    persistStore();
    res.status(502).json({
      error: "Guest registration was captured, but the check-in email could not be sent.",
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

app.post("/api/admin/send-checkin-emails", async (req, res) => {
  const force = Boolean(req.body?.force);
  const approvedGuests = store.guests.filter(
    (guest) => !guest.archived && guest.approvalStatus === "approved",
  );
  const results = [];

  for (const guest of approvedGuests) {
    try {
      const result = await sendRegistrationEmail(guest, force);
      results.push({
        guestId: guest.guestId,
        email: guest.email,
        ...result,
      });
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

  const sent = results.filter((item) => !item.skipped && !item.failed).length;
  const skipped = results.filter((item) => item.skipped).length;
  const failed = results.filter((item) => item.failed).length;

  if (failed) {
    const failureSummary = results
      .filter((item) => item.failed)
      .map((item) => `${item.email}: ${item.error}`)
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

  res.json({
    success: true,
    sent,
    skipped,
    failed: 0,
    results,
  });
});

app.get("/api/emails", (_req, res) => {
  res.json({
    deliveryMode: mailer.deliveryMode,
    emails: store.emails.slice(0, 50),
  });
});

app.get("/api/emails/:emailId/preview", (req, res) => {
  const filePath = path.join(config.EMAIL_PREVIEW_DIR, `${req.params.emailId}.html`);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Email preview not found.");
    return;
  }

  res.type("html").send(fs.readFileSync(filePath, "utf8"));
});

app.get("/api/qr/:guestId", async (req, res) => {
  const guest = getGuestById(req.params.guestId);
  if (!guest) {
    res.status(404).json({ error: "Guest not found." });
    return;
  }

  const pngBuffer = await QRCode.toBuffer(guest.checkInPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: {
      dark: "#10231d",
      light: "#fffdf7",
    },
  });

  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
});

app.post("/api/check-in/scan", async (req, res) => {
  const parsed = parseScannedValue(req.body?.scanData);
  logServer("checkin.scan.received", {
    scanType: parsed?.type || null,
    rawProvided: Boolean(req.body?.scanData),
  });
  if (!parsed) {
    res.status(400).json({ error: "Provide QR scan data or a fallback code." });
    return;
  }

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

  let claimEmailResult = null;
  try {
    claimEmailResult = await sendClaimReadyEmail(guest);
  } catch (error) {
    logServer("checkin.scan.claim_email_failed", {
      guestId: guest.guestId,
      email: guest.email,
      error: error.message,
    });
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

app.get("/api/claims/context", (req, res) => {
  const claimToken = String(req.query.token || "").trim();
  if (!claimToken) {
    res.status(400).json({ error: "Claim token is required." });
    return;
  }

  const guest = getGuestByClaimToken(claimToken);
  if (!guest) {
    res.status(404).json({ error: "Claim invitation not found." });
    return;
  }

  res.json({
    event: getEvent(),
    claimToken,
    guest: summarizeGuest(guest),
    status: guest.claim?.claimedAt ? "claimed" : guest.checkedInAt ? "claimable" : "awaiting-check-in",
    claimUrl: buildPublicClaimUrl(guest),
  });
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Use a password with at least 8 characters." });
    return;
  }

  if (getAccountByEmail(email)) {
    res.status(409).json({ error: "An account already exists for this email." });
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  const encryptedWalletJson = await wallet.encrypt(password);
  const passwordDigest = await hashPassword(password);

  const account = {
    accountId: createId("acct"),
    email,
    passwordSalt: passwordDigest.salt,
    passwordHash: passwordDigest.hash,
    walletAddress: wallet.address,
    encryptedWalletJson,
    createdAt: new Date().toISOString(),
  };

  store.accounts.push(account);
  persistStore();

  const authToken = createSessionToken(account.accountId, config.SESSION_SECRET);
  res.status(201).json({
    success: true,
    authToken,
    account: getAccountPayload(account),
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const account = getAccountByEmail(email);

  if (!account) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const valid = await verifyPassword(password, account.passwordSalt, account.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const authToken = createSessionToken(account.accountId, config.SESSION_SECRET);
  res.json({
    success: true,
    authToken,
    account: getAccountPayload(account),
  });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const account = getAccountByEmail(email);

  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  if (account) {
    store.accounts = store.accounts.filter(
      (storedAccount) => storedAccount.accountId !== account.accountId,
    );
    persistStore();
  }

  res.json({
    success: true,
    message: "If an account exists for that email, it has been removed. You can create it again now.",
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  refreshStoreFromDisk();
  const account = getAccountById(req.account.accountId);
  res.json({
    success: true,
    event: getEvent(),
    account: getAccountPayload(account),
  });
});

app.post("/api/claims/refresh", requireAuth, async (req, res) => {
  const account = getAccountById(req.account.accountId);
  const claimToken = String(req.body?.claimToken || "").trim();
  const currentPassword = String(req.body?.currentPassword || "");
  const resendEmail = req.body?.resendEmail !== false;
  const guest = claimToken ? getGuestByClaimToken(claimToken) : getGuestForAccount(account);

  if (!guest) {
    res.status(404).json({ error: "No eligible guest record was found for this account." });
    return;
  }

  if (normalizeEmail(guest.email) !== account.email) {
    res.status(403).json({
      error: "This claim link belongs to a different email address than the logged-in account.",
    });
    return;
  }

  if (!guest.checkedInAt) {
    res.status(409).json({ error: "The guest must be checked in before refreshing the claim flow." });
    return;
  }

  let resetMode = "local-reset";
  let burnResult = null;
  const existingTokenId = guest.claim?.tokenId ?? null;

  if (existingTokenId != null) {
    if (isChainConfigured(config)) {
      try {
        burnResult = await burnBadge(config, existingTokenId);
        resetMode = "burned-on-chain";
      } catch (error) {
        if (!currentPassword) {
          res.status(409).json({
            error:
              "The existing token could not be burned on-chain. Provide your current password so we can rotate to a fresh demo wallet for another mint test.",
            details: error.message,
          });
          return;
        }
      }
    } else if (!currentPassword) {
      res.status(409).json({
        error:
          "Blockchain burn is not configured. Provide your current password so we can rotate to a fresh demo wallet for another mint test.",
      });
      return;
    }

    if (!burnResult) {
      const valid = await verifyPassword(
        currentPassword,
        account.passwordSalt,
        account.passwordHash,
      );
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }

      const replacementWallet = ethers.Wallet.createRandom();
      account.walletAddress = replacementWallet.address;
      account.encryptedWalletJson = await replacementWallet.encrypt(currentPassword);
      resetMode = "rotated-wallet";
    }
  }

  guest.claim = null;
  guest.claimToken = createToken(12);
  guest.claimEmailSentAt = null;

  let claimEmailResult = {
    skipped: true,
    claimUrl: buildPublicClaimUrl(guest),
  };

  if (resendEmail) {
    try {
      claimEmailResult = await sendClaimReadyEmail(guest);
    } catch (error) {
      persistStore();
      res.status(502).json({
        error: "The claim was refreshed, but the new claim email could not be sent.",
        details: error.message,
        resetMode,
        claimUrl: buildPublicClaimUrl(guest),
        burnedTokenId: existingTokenId,
        burnTxHash: burnResult?.txHash || null,
      });
      return;
    }
  }

  persistStore();

  res.json({
    success: true,
    resetMode,
    claimUrl: claimEmailResult.claimUrl,
    claimEmailSent: !claimEmailResult.skipped,
    burnedTokenId: existingTokenId,
    burnTxHash: burnResult?.txHash || null,
    guest: summarizeGuest(guest),
    account: getAccountPayload(account),
  });
});

app.post("/api/claims/claim", requireAuth, async (req, res) => {
  const account = getAccountById(req.account.accountId);
  const claimToken = String(req.body?.claimToken || "").trim();
  const guest = claimToken ? getGuestByClaimToken(claimToken) : getGuestForAccount(account);

  if (!guest) {
    res.status(404).json({ error: "No eligible guest record was found for this account." });
    return;
  }

  if (normalizeEmail(guest.email) !== account.email) {
    res.status(403).json({
      error: "This claim link belongs to a different email address than the logged-in account.",
    });
    return;
  }

  if (!guest.checkedInAt) {
    res.status(409).json({ error: "The guest must be checked in before claiming a badge." });
    return;
  }

  if (guest.claim?.claimedAt) {
    res.json({
      success: true,
      alreadyClaimed: true,
      claim: guest.claim,
      verifyUrl: `/verify/${encodeURIComponent(guest.claim.tokenId)}`,
    });
    return;
  }

  if (!isChainConfigured(config)) {
    res.status(503).json({
      error:
        "Blockchain minting is not configured yet. Set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS to enable claims.",
    });
    return;
  }

  try {
    const guestEventId = getGuestEventId(guest);
    const guestEventName = getGuestEventName(guest);
    const mintResult = await mintBadge(config, account.walletAddress, guestEventId);
    guest.claim = {
      claimedAt: new Date().toISOString(),
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
      blockNumber: mintResult.blockNumber,
      walletAddress: account.walletAddress,
      eventId: guestEventId,
      eventName: guestEventName,
      contractAddress: config.CONTRACT_ADDRESS,
      verifyUrl: buildPublicVerifyUrl(mintResult.tokenId),
    };

    persistStore();

    res.json({
      success: true,
      claim: guest.claim,
      verifyUrl: `/verify/${encodeURIComponent(mintResult.tokenId)}`,
      account: getAccountPayload(account),
    });
  } catch (error) {
    res.status(500).json({
      error: "Badge minting failed.",
      details: error.message,
    });
  }
});

app.get("/api/badges/:tokenId/verify", async (req, res) => {
  if (!isChainConfigured(config)) {
    res.status(503).json({
      error:
        "Blockchain verification is not configured yet. Set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.",
    });
    return;
  }

  try {
    const tokenId = Number(req.params.tokenId);
    const chainData = await verifyBadge(config, tokenId);
    const localGuest = store.guests.find((guest) => guest.claim?.tokenId === tokenId);

    res.json({
      success: true,
      event: getEvent(),
      badge: {
        ...chainData,
        txHash: localGuest?.claim?.txHash || null,
        claimedAt: localGuest?.claim?.claimedAt || null,
        verifyUrl: buildPublicVerifyUrl(tokenId),
        attendeeEmail: localGuest?.email || null,
        attendeeName: localGuest?.name || null,
      },
    });
  } catch (error) {
    res.status(404).json({
      error: "Badge could not be verified on-chain.",
      details: error.message,
    });
  }
});

app.post("/api/mint", async (req, res) => {
  const { eventContext } = req.body || {};
  const eventId = eventContext?.eventId || getEvent().id;
  const eventName = eventContext?.eventName || getEvent().name;

  if (!eventId) {
    res.status(400).json({ error: "Missing eventId in request body." });
    return;
  }

  if (!config.DUMMY_ACCOUNT_ADDRESS) {
    res.status(400).json({
      error: "DUMMY_ACCOUNT_ADDRESS is not configured for the legacy demo mint route.",
    });
    return;
  }

  if (!isChainConfigured(config)) {
    res.status(503).json({
      error:
        "Blockchain minting is not configured yet. Set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.",
    });
    return;
  }

  try {
    const mintResult = await mintBadge(config, config.DUMMY_ACCOUNT_ADDRESS, eventId);
    res.json({
      success: true,
      message: `Participation badge minted successfully for ${eventName}.`,
      transactionHash: mintResult.txHash,
      dummyAddress: config.DUMMY_ACCOUNT_ADDRESS,
      tokenId: mintResult.tokenId,
    });
  } catch (error) {
    res.status(500).json({
      error: "Legacy minting failed.",
      details: error.message,
    });
  }
});

app.listen(config.PORT, () => {
  const event = getEvent();
  logServer("server.started", {
    baseUrl: config.BASE_URL,
    port: config.PORT,
    eventId: event.id,
    eventName: event.name,
    guestsLoaded: store.guests.filter((guest) => !guest.archived).length,
    accountsLoaded: store.accounts.length,
    emailsLoaded: store.emails.length,
    emailDeliveryMode: mailer.deliveryMode,
    blockchainClaimsEnabled: isChainConfigured(config),
    contractAddress: config.CONTRACT_ADDRESS || null,
  });
});
