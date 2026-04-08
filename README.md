# Decentralized Event Participation Badge System

## Overview
Current event verification (e.g., Luma confirmation emails or screenshots) relies on centralized platforms and is easily forged. This project implements an independent, blockchain-based verification system using **Soulbound Tokens (SBTs)** to provide immutable attendance records.

By bridging off-chain registration data (Luma) with the **Base blockchain** via a Chrome extension and a backend relayer, we issue non-transferable badges that serve as verifiable credentials for participants automatically.

## Team - 9
- **Chandra Shekhar Pavuluri**
- **Yuvraj Rasal**
- **Siddanagouda Patil**
- **Sai Manaswi Seela**
- **Harshit Kumar Metpally**

---

## 🏗 System Architecture
1. **Chrome Extension**: Detects Luma event registrations (`lu.ma` and `luma.com`) and captures event context.
2. **Backend Relayer**: A Node.js Express server that receives event data from the extension and executes the on-chain mint transaction.
3. **Smart Contract**: Deployed on Base (or local Hardhat node), it handles the creation of the non-transferable Soulbound tokens.
4. **Base Network**: The Layer 2 blockchain ledger where badges are stored as permanent participation records.

---

## 🚀 Setup & Installation

### 1. Root Project Setup
```bash
git clone https://github.com/Manaswi875/Team-9-Decentralized-Event-Participation-Badge-System
cd Team-9-Decentralized-Event-Participation-Badge-System
npm install
```

### 2. Backend Configuration
1. Navigate to the backend folder:
   ```bash
   cd backend
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your `CONTRACT_ADDRESS` after deployment (see below).

### 3. Chrome Extension Installation
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `chrome-extension` folder in this repository.

---

## 🧪 End-to-End Testing

To test the system locally without needing real crypto, follow these steps in order using separate terminal windows:

### Step 1: Start Local Blockchain
In your first terminal (root directory):
```bash
npx hardhat node
```
*Keep this running. It provides local test accounts.*

### Step 2: Deploy Smart Contract
In a second terminal (root directory):
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*Copy the printed contract address and paste it into `backend/.env`.*

### Step 3: Run Backend Relayer
In a third terminal (`/backend` directory):
```bash
npm start
```

### Step 4: Simulate on Luma
1. Go to any Luma page (e.g., [luma.com/ai](https://luma.com/ai) or [lu.ma](https://lu.ma)).
2. Click the blue **"Mint Badge (Simulate Registration)"** button in the bottom right.
3. Observe the success animation and the transaction receipt on your screen!

---

## 📄 Smart Contract Details
The badges are implemented as ERC-721 tokens with transfer logic disabled to ensure they are **Soulbound**.

```solidity
interface IParticipationBadge {
    // Mints a badge for an attendee
    function mintBadge(address to, string memory eventId) external returns (uint256);

    // Returns event ID for a given badge
    function getEventForBadge(uint256 tokenId) external view returns (string memory);
}
```

### Smart Contract Tests
To run purely the smart contract logic tests:
```bash
npx hardhat test
```
![Test Results Result](./test_output.png)

---

## 🛠 Repository Structure
- `/contracts`: Solidity SBT implementation.
- `/backend`: Node.js Express relayer API.
- `/chrome-extension`: Extension source code.
- `/scripts`: Deployment and migration scripts.
- `/test`: Smart contract test suite.
