const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DUMMY_ACCOUNT_ADDRESS = process.env.DUMMY_ACCOUNT_ADDRESS || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// Minimal ABI to interact with our ParticipationBadge contract
const ABI = [
  "function mintBadge(address to, string memory eventId) public returns (uint256)"
];

app.post('/api/mint', async (req, res) => {
  try {
    const { eventContext } = req.body;
    
    if (!eventContext || !eventContext.eventId) {
      return res.status(400).json({ error: "Missing eventId in request body" });
    }

    const { eventId, eventName } = eventContext;
    console.log(`[Minting Request] Detected Luma Event: ${eventName} (${eventId})`);
    
    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);
    
    console.log(`Minting participation badge to Dummy Account: ${DUMMY_ACCOUNT_ADDRESS}`);
    
    // Call the smart contract mint function
    const tx = await contract.mintBadge(DUMMY_ACCOUNT_ADDRESS, eventId);
    console.log(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed! Block number: ${receipt.blockNumber}`);

    res.status(200).json({
      success: true,
      message: "Participation badge minted successfully to dummy account",
      transactionHash: tx.hash,
      dummyAddress: DUMMY_ACCOUNT_ADDRESS
    });
    
  } catch (error) {
    console.error("Error during minting process:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Luma-Base Bridge Backend running on http://localhost:${PORT}`);
  console.log(`Monitoring dummy account: ${DUMMY_ACCOUNT_ADDRESS}`);
});
