const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ParticipationBadge", function () {
  let ParticipationBadge;
  let badge;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    ParticipationBadge = await ethers.getContractFactory("ParticipationBadge");
    badge = await ParticipationBadge.deploy();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await badge.name()).to.equal("EventParticipationBadge");
      expect(await badge.symbol()).to.equal("EPB");
    });

    it("Should set the right owner", async function () {
      expect(await badge.owner()).to.equal(owner.address);
    });
  });

  // ─── Minting ─────────────────────────────────────────────────────────────────

  describe("Minting", function () {
    it("Should allow owner to mint and store event ID", async function () {
      await badge.mintBadge(addr1.address, "LUMA-001");

      expect(await badge.getEventForBadge(1)).to.equal("LUMA-001");
      expect(await badge.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should reject minting from non-owner accounts", async function () {
      await expect(
        badge.connect(addr1).mintBadge(addr1.address, "HACK")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should emit a BadgeMinted event on successful mint", async function () {
      await expect(badge.mintBadge(addr1.address, "LUMA-002"))
        .to.emit(badge, "BadgeMinted")
        .withArgs(addr1.address, 1, "LUMA-002");
    });

    it("Should assign incrementing token IDs across multiple mints", async function () {
      await badge.mintBadge(addr1.address, "LUMA-A");
      await badge.mintBadge(addr2.address, "LUMA-B");

      expect(await badge.ownerOf(1)).to.equal(addr1.address);
      expect(await badge.ownerOf(2)).to.equal(addr2.address);
    });
  });

  // ─── Duplicate Prevention ────────────────────────────────────────────────────

  describe("Duplicate Prevention", function () {
    it("Should set hasBadge to true after minting", async function () {
      await badge.mintBadge(addr1.address, "LUMA-DUP");
      expect(await badge.hasBadge(addr1.address, "LUMA-DUP")).to.equal(true);
    });

    it("Should return false for hasBadge before any mint", async function () {
      expect(await badge.hasBadge(addr1.address, "LUMA-DUP")).to.equal(false);
    });

    it("Should revert if the same wallet tries to mint the same event twice", async function () {
      await badge.mintBadge(addr1.address, "LUMA-DUP");

      await expect(
        badge.mintBadge(addr1.address, "LUMA-DUP")
      ).to.be.revertedWith(
        "ParticipationBadge: Badge already issued to this address for this event."
      );
    });

    it("Should allow the same wallet to mint badges for different events", async function () {
      await badge.mintBadge(addr1.address, "LUMA-EVENT-A");
      await badge.mintBadge(addr1.address, "LUMA-EVENT-B");

      expect(await badge.ownerOf(1)).to.equal(addr1.address);
      expect(await badge.ownerOf(2)).to.equal(addr1.address);
      expect(await badge.hasBadge(addr1.address, "LUMA-EVENT-A")).to.equal(true);
      expect(await badge.hasBadge(addr1.address, "LUMA-EVENT-B")).to.equal(true);
    });

    it("Should allow different wallets to mint badges for the same event", async function () {
      await badge.mintBadge(addr1.address, "LUMA-SHARED");
      await badge.mintBadge(addr2.address, "LUMA-SHARED");

      expect(await badge.ownerOf(1)).to.equal(addr1.address);
      expect(await badge.ownerOf(2)).to.equal(addr2.address);
    });
  });

  // ─── Token URI / Metadata ────────────────────────────────────────────────────

  describe("Token URI and Metadata", function () {
    it("Should return a data URI string for a minted token", async function () {
      await badge.mintBadge(addr1.address, "LUMA-META");
      const uri = await badge.tokenURI(1);

      expect(uri).to.be.a("string");
      expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    });

    it("Should decode to valid JSON containing the correct event ID", async function () {
      await badge.mintBadge(addr1.address, "LUMA-META");
      const uri = await badge.tokenURI(1);

      // Strip the data URI prefix and decode the Base64 payload
      const base64Payload = uri.replace("data:application/json;base64,", "");
      const decoded = Buffer.from(base64Payload, "base64").toString("utf8");
      const metadata = JSON.parse(decoded);

      expect(metadata.name).to.equal("Event Participation Badge #1");
      expect(metadata.description).to.include("LUMA-META");
      expect(metadata.image).to.include("data:image/svg+xml;base64,");

      const eventAttr = metadata.attributes.find(a => a.trait_type === "Event ID");
      expect(eventAttr).to.not.be.undefined;
      expect(eventAttr.value).to.equal("LUMA-META");
    });

    it("Should embed a valid SVG image in the metadata", async function () {
      await badge.mintBadge(addr1.address, "LUMA-SVG");
      const uri = await badge.tokenURI(1);

      const base64Json = uri.replace("data:application/json;base64,", "");
      const metadata = JSON.parse(Buffer.from(base64Json, "base64").toString("utf8"));

      const base64Svg = metadata.image.replace("data:image/svg+xml;base64,", "");
      const svg = Buffer.from(base64Svg, "base64").toString("utf8");

      expect(svg).to.include("<svg");
      expect(svg).to.include("LUMA-SVG");
      expect(svg).to.include("PARTICIPATION BADGE");
    });

    it("Should revert tokenURI for a token that does not exist", async function () {
      await expect(badge.tokenURI(999)).to.be.reverted;
    });
  });

  // ─── Soulbound Property ──────────────────────────────────────────────────────

  describe("Soulbound Property (Non-transferable)", function () {
    it("Should block transfers between two user addresses", async function () {
      await badge.mintBadge(addr1.address, "EVENT-X");

      await expect(
        badge.connect(addr1).transferFrom(addr1.address, addr2.address, 1)
      ).to.be.revertedWith(
        "ParticipationBadge: This badge is permanent and cannot be moved."
      );
    });

    it("Should block safeTransferFrom as well", async function () {
      await badge.mintBadge(addr1.address, "EVENT-X");

      await expect(
        badge.connect(addr1)["safeTransferFrom(address,address,uint256)"](
          addr1.address, addr2.address, 1
        )
      ).to.be.revertedWith(
        "ParticipationBadge: This badge is permanent and cannot be moved."
      );
    });
  });
});
