/**
 *  GET  /api/badges/:tokenId/verify – Verify a minted badge on-chain
 *  POST /api/mint                   – Legacy demo mint to DUMMY_ACCOUNT_ADDRESS
 */

const { Router } = require("express");

const { getStore } = require("../store");
const {
  mintBadge,
  verifyBadge,
  isChainConfigured,
} = require("../lib/blockchain");
const config = require("../lib/config");
const { getEvent } = require("../helpers/eventHelpers");
const { buildPublicVerifyUrl } = require("../helpers/urlHelpers");

const router = Router();

router.get("/api/badges/:tokenId/verify", async (req, res) => {
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

    // Enrich the on-chain data with local metadata when available.
    const localGuest = getStore().guests.find(
      (g) => g.claim?.tokenId === tokenId,
    );

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

router.post("/api/mint", async (req, res) => {
  const { eventContext } = req.body || {};
  const eventId = eventContext?.eventId || getEvent().id;
  const eventName = eventContext?.eventName || getEvent().name;

  if (!eventId) {
    res.status(400).json({ error: "Missing eventId in request body." });
    return;
  }

  if (!config.DUMMY_ACCOUNT_ADDRESS) {
    res.status(400).json({
      error:
        "DUMMY_ACCOUNT_ADDRESS is not configured for the legacy demo mint route.",
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
    const mintResult = await mintBadge(
      config,
      config.DUMMY_ACCOUNT_ADDRESS,
      eventId,
    );
    res.json({
      success: true,
      message: `Participation badge minted successfully for ${eventName}.`,
      transactionHash: mintResult.txHash,
      dummyAddress: config.DUMMY_ACCOUNT_ADDRESS,
      tokenId: mintResult.tokenId,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Legacy minting failed.", details: error.message });
  }
});

module.exports = router;
