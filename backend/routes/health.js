/**
 * Lightweight health-check endpoint used by load balancers and monitoring.
 * Returns the current event, email delivery mode, and whether the blockchain
 * integration is wired up.
 */

const { Router } = require("express");
const { isChainConfigured } = require("../lib/blockchain");
const config = require("../lib/config");
const mailer = require("../mailerInstance");
const { getEvent } = require("../helpers/eventHelpers");

const router = Router();

router.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    event: getEvent(),
    deliveryMode: mailer.deliveryMode,
    chainConfigured: isChainConfigured(config),
  });
});

module.exports = router;
