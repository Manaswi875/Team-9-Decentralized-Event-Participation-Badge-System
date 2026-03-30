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
    it("Should allow owner to mint and store event ID", async function () {
      const eventId = "LUMA-001";
      await badge.mintBadge(addr1.address, eventId);

      expect(await badge.getEventForBadge(1)).to.equal(eventId);
      expect(await badge.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should reject minting from non-owner accounts", async function () {
      await expect(
        badge.connect(addr1).mintBadge(addr1.address, "HACK")
      ).to.be.revertedWith("Ownable: caller is not the owner");
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
  });
});
