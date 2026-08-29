/**
 * Serves the static HTML entry-points for each client-side page.
 * All routing within those pages is handled client-side.
 */

const path = require("path");
const { Router } = require("express");
const config = require("../lib/config");

const router = Router();

router.get("/", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "index.html"));
});

router.get("/staff", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "staff.html"));
});

router.get("/claim", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "claim.html"));
});

// Both /verify and /verify/:tokenId serve the same shell; the token is read
// client-side from the URL so a single HTML file handles both cases.
router.get("/verify", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "verify.html"));
});

router.get("/verify/:tokenId", (_req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, "verify.html"));
});

module.exports = router;
