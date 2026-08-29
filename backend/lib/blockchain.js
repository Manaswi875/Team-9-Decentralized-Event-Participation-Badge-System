const { ethers } = require("ethers");

const ABI = [
  "event BadgeMinted(uint256 indexed tokenId, address indexed attendee, bytes32 indexed eventHash, string eventId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function mintBadge(address to, string memory eventId) public returns (uint256)",
  "function burnBadge(uint256 tokenId) public",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function getEventForBadge(uint256 tokenId) public view returns (string memory)",
];

function isChainConfigured(config) {
  return Boolean(config.RPC_URL && config.PRIVATE_KEY && config.CONTRACT_ADDRESS);
}

function getContract(config) {
  if (!isChainConfigured(config)) {
    throw new Error(
      "Blockchain configuration is incomplete. Set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.",
    );
  }

  const provider = new ethers.JsonRpcProvider(config.RPC_URL);
  const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(config.CONTRACT_ADDRESS, ABI, wallet);

  return { provider, wallet, contract };
}

async function mintBadge(config, recipientAddress, eventId) {
  const { contract } = getContract(config);
  const tx = await contract.mintBadge(recipientAddress, eventId);
  const receipt = await tx.wait();

  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "BadgeMinted") {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (tokenId == null) {
    throw new Error("Mint succeeded but token ID could not be determined from the receipt.");
  }

  return {
    tokenId,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function verifyBadge(config, tokenId) {
  const { contract } = getContract(config);
  const [owner, eventId] = await Promise.all([
    contract.ownerOf(tokenId),
    contract.getEventForBadge(tokenId),
  ]);

  return {
    tokenId: Number(tokenId),
    owner,
    eventId,
    contractAddress: config.CONTRACT_ADDRESS,
  };
}

async function burnBadge(config, tokenId) {
  const { contract } = getContract(config);
  const tx = await contract.burnBadge(tokenId);
  const receipt = await tx.wait();

  return {
    tokenId: Number(tokenId),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

module.exports = {
  burnBadge,
  isChainConfigured,
  mintBadge,
  verifyBadge,
};
