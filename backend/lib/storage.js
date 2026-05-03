const fs = require("fs");
const path = require("path");

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createEmptyStore() {
  return {
    version: 1,
    event: null,
    guests: [],
    accounts: [],
    emails: [],
  };
}

function loadStore(storeFile) {
  if (!fs.existsSync(storeFile)) {
    return createEmptyStore();
  }

  return JSON.parse(fs.readFileSync(storeFile, "utf8"));
}

function saveStore(storeFile, store) {
  ensureDirectory(path.dirname(storeFile));
  const tmpFile = `${storeFile}.tmp`;
  fs.writeFileSync(tmpFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tmpFile, storeFile);
}

function buildCheckInPayload(checkInToken) {
  return `badgepop://check-in/${checkInToken}`;
}

function serializeGuestForClient(guest, eventId) {
  const claimed = Boolean(guest.claim?.claimedAt);
  const checkedIn = Boolean(guest.checkedInAt);

  return {
    guestId: guest.guestId,
    name: guest.name,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    ticketName: guest.ticketName,
    approvalStatus: guest.approvalStatus,
    checkInCode: guest.checkInCode,
    qrImageUrl: `/api/qr/${encodeURIComponent(guest.guestId)}`,
    checkedInAt: guest.checkedInAt,
    registrationEmailSentAt: guest.registrationEmailSentAt,
    claimEmailSentAt: guest.claimEmailSentAt,
    claimStatus: claimed ? "claimed" : checkedIn ? "claimable" : "awaiting-check-in",
    walletAddress: guest.claim?.walletAddress || null,
    badgeTokenId: guest.claim?.tokenId || null,
    verifyUrl:
      guest.claim?.tokenId != null ? `/verify/${encodeURIComponent(guest.claim.tokenId)}` : null,
    onChainEventId: eventId,
    archived: Boolean(guest.archived),
  };
}

module.exports = {
  buildCheckInPayload,
  createEmptyStore,
  ensureDirectory,
  loadStore,
  saveStore,
  serializeGuestForClient,
};
