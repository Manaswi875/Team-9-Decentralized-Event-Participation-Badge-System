/**
 * Application entry point.
 *
 *  • Create the Express app and register global middleware
 *  • Mount all route modules
 *  • Start the HTTP server
 */

const cors = require("cors");
const express = require("express");

const config = require("./lib/config");
const { isChainConfigured } = require("./lib/blockchain");
const mailer = require("./mailerInstance");
const { getStore } = require("./store");
const { logServer } = require("./logger");
const { getEvent } = require("./helpers/eventHelpers");

// Route modules
const staticRoutes = require("./routes/static");
const healthRoutes = require("./routes/health");
const dashboardRoutes = require("./routes/dashboard");
const guestRoutes = require("./routes/guests");
const checkInRoutes = require("./routes/checkIn");
const claimRoutes = require("./routes/claims");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const emailRoutes = require("./routes/emails");
const badgeRoutes = require("./routes/badges");
const lumaRoutes = require("./routes/integrations/luma");

// App setup
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve files from the public directory (JS bundles, CSS, images, etc.)
app.use(express.static(config.PUBLIC_DIR));

// Route registration

// HTML page shells
app.use(staticRoutes);

// API endpoints — grouped by domain
app.use(healthRoutes);
app.use(dashboardRoutes);
app.use(guestRoutes);
app.use(checkInRoutes);
app.use(claimRoutes);
app.use(authRoutes);
app.use(adminRoutes);
app.use(emailRoutes);
app.use(badgeRoutes);
app.use(lumaRoutes);

// Start
app.listen(config.PORT, () => {
  const store = getStore();
  const event = getEvent();

  logServer("server.started", {
    baseUrl: config.BASE_URL,
    port: config.PORT,
    eventId: event.id,
    eventName: event.name,
    guestsLoaded: store.guests.filter((g) => !g.archived).length,
    accountsLoaded: store.accounts.length,
    emailsLoaded: store.emails.length,
    emailDeliveryMode: mailer.deliveryMode,
    blockchainClaimsEnabled: isChainConfigured(config),
    contractAddress: config.CONTRACT_ADDRESS || null,
  });
});
