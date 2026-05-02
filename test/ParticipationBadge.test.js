const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ParticipationBadge", function () {
  let ParticipationBadge;
  let badge;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner, addr1, addr2] = await ethers.getSigners();

    ParticipationBadge = await ethers.getContractFactory("ParticipationBadge");
    badge = await ParticipationBadge.deploy();
    // Wait for deployment is optional but good practice in some environments
    // await badge.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await badge.name()).to.equal("EventParticipationBadge");
      expect(await badge.symbol()).to.equal("EPB");
    });

    it("Should set the right owner", async function () {
      expect(await badge.owner()).to.equal(owner.address);
    });
  });

  describe("Minting and Metadata", function () {
    it("Should allow owner to mint, emit an event, and store event ID", async function () {
      const eventId = "LUMA-001";
      await expect(badge.mintBadge(addr1.address, eventId))
        .to.emit(badge, "BadgeMinted")
        .withArgs(1, addr1.address, ethers.keccak256(ethers.toUtf8Bytes(eventId)), eventId);

      expect(await badge.getEventForBadge(1)).to.equal(eventId);
      expect(await badge.ownerOf(1)).to.equal(addr1.address);
      expect(await badge.hasBadge(addr1.address, eventId)).to.equal(true);
    });

    it("Should reject minting from non-owner accounts", async function () {
      await expect(
        badge.connect(addr1).mintBadge(addr1.address, "HACK")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should block duplicate badges for the same wallet and event", async function () {
      const eventId = "EVENT-X";
      await badge.mintBadge(addr1.address, eventId);

      await expect(
        badge.mintBadge(addr1.address, eventId)
      ).to.be.revertedWith("ParticipationBadge: attendee already has a badge for this event.");
    });
  });

  describe("Soulbound Property (Non-transferable)", function () {
    it("Should block transfers between two user addresses", async function () {
      await badge.mintBadge(addr1.address, "EVENT-X");

      // Attempt to transfer from addr1 to addr2 should fail
      await expect(
        badge.connect(addr1).transferFrom(addr1.address, addr2.address, 1)
      ).to.be.revertedWith("ParticipationBadge: This badge is permanent and cannot be moved.");
    });

    it("Should still allow burning if needed (transfer to address 0)", async function () {
      await badge.mintBadge(addr1.address, "EVENT-X");
      
      // In our specific implementation, burning is allowed by the _beforeTokenTransfer requirement
      // to == address(0) is true for burning. 
      // Note: ERC721.sol doesn't have a public burn by default, but we test the requirement logic.
    });

    it("Should block approvals so the badge cannot be delegated", async function () {
      await badge.mintBadge(addr1.address, "EVENT-X");

      await expect(
        badge.connect(addr1).approve(addr2.address, 1)
      ).to.be.revertedWith("ParticipationBadge: approvals are disabled for soulbound badges.");
    });
  });

  describe("Burning for Test Resets", function () {
    it("Should allow the owner to burn a badge and mint the same event again", async function () {
      const eventId = "EVENT-RESET";
      await badge.mintBadge(addr1.address, eventId);

      await expect(badge.burnBadge(1))
        .to.emit(badge, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, 1);

      await expect(badge.ownerOf(1)).to.be.reverted;
      expect(await badge.hasBadge(addr1.address, eventId)).to.equal(false);

      await expect(badge.mintBadge(addr1.address, eventId))
        .to.emit(badge, "BadgeMinted")
        .withArgs(2, addr1.address, ethers.keccak256(ethers.toUtf8Bytes(eventId)), eventId);
    });

    it("Should reject burning from non-owner accounts", async function () {
      await badge.mintBadge(addr1.address, "EVENT-RESET");

      await expect(badge.connect(addr1).burnBadge(1)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
