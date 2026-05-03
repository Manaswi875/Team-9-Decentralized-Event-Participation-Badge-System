/**
 *  GET /api/emails                  – List the most recent 50 email records
 *  GET /api/emails/:emailId/preview – Serve the stored HTML preview for one email
 */

const fs = require("fs");
const path = require("path");
const { Router } = require("express");

const { getStore } = require("../store");
const config = require("../lib/config");
const mailer = require("../mailerInstance");

const router = Router();

router.get("/api/emails", (_req, res) => {
  res.json({
    deliveryMode: mailer.deliveryMode,
    // Cap at 50 to keep the response size reasonable.
    emails: getStore().emails.slice(0, 50),
  });
});

router.get("/api/emails/:emailId/preview", (req, res) => {
  const filePath = path.join(
    config.EMAIL_PREVIEW_DIR,
    `${req.params.emailId}.html`,
  );

  if (!fs.existsSync(filePath)) {
    res.status(404).send("Email preview not found.");
    return;
  }

  res.type("html").send(fs.readFileSync(filePath, "utf8"));
});

module.exports = router;
