/**
 * Returns aggregated statistics consumed by the staff dashboard.
 * All values are computed on the fly from the in-memory store.
 */

const { Router } = require("express");
const { isChainConfigured } = require("../lib/blockchain");
const config = require("../lib/config");
const mailer = require("../mailerInstance");
const { getStore } = require("../store");
const { getEvent } = require("../helpers/eventHelpers");
const { summarizeGuest } = require("../services/guestService");

const router = Router();

router.get("/api/dashboard", (_req, res) => {
  const store = getStore();

  // Work only with non-archived guests.
  const guests = store.guests.filter((g) => !g.archived);

  const checkedInCount = guests.filter((g) => g.checkedInAt).length;
  const claimedCount = guests.filter((g) => g.claim?.claimedAt).length;
  const registrationEmailCount = guests.filter(
    (g) => g.registrationEmailSentAt,
  ).length;
  const claimEmailCount = guests.filter((g) => g.claimEmailSentAt).length;

  // Latest 8 check-ins for the "recent activity" panel.
  const recentCheckIns = guests
    .filter((g) => g.checkedInAt)
    .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
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
      approvedGuests: guests.filter((g) => g.approvalStatus === "approved")
        .length,
      checkedInGuests: checkedInCount,
      // Guests who have checked in but not yet claimed their badge.
      claimableGuests: checkedInCount - claimedCount,
      claimedBadges: claimedCount,
      accountsCreated: store.accounts.length,
      registrationEmailCount,
      claimEmailCount,
    },
    recentCheckIns,
  });
});

module.exports = router;
