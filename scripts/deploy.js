const hre = require("hardhat");

async function main() {
  console.log("Deploying ParticipationBadge Contract...");

  // Get the contract factory
  const ParticipationBadge = await hre.ethers.getContractFactory("ParticipationBadge");
  
  // Deploy the contract
  const badge = await ParticipationBadge.deploy();

  // Wait for deployment is optional but good practice
  // await badge.waitForDeployment();

  console.log(`ParticipationBadge deployed to: ${badge.address || await badge.getAddress()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
