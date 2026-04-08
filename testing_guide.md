# End-to-End Testing Guide

This guide will walk you through how to test the **Decentralized Event Participation Badge System** locally, bridging Luma registrations to your local Base/Hardhat blockchain.

## Prerequisites
- Node.js installed
- Google Chrome browser

## 1. Start the Local Blockchain & Deploy Contract

1. Open a new terminal from the root folder `Team-9-Decentralized-Event-Participation-Badge-System`.
2. Start the local Hardhat node:
   ```bash
   npx hardhat node
   ```
   *(Keep this terminal running. It will print 20 test accounts and their private keys. We will use the first account as the deployer/owner, and the second account as the Dummy Account)*
3. Open a **second terminal** in the root folder, and deploy the smart contract to your local node:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```
4. Copy the deployed **Contract Address** from the console output.

## 2. Set Up and Run the Node.js Backend

1. Open a **third terminal** and navigate into the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file and replace `CONTRACT_ADDRESS` with the address you copied in step 1. *(The `PRIVATE_KEY` and `DUMMY_ACCOUNT_ADDRESS` are already pre-filled with Hardhat's default test accounts #0 and #1)*.
5. Start the backend relayer server:
   ```bash
   npm start
   ```
   *(It should display "Luma-Base Bridge Backend running on http://localhost:3000")*

## 3. Load the Chrome Extension

1. Open Google Chrome.
2. Go to the address bar and type `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `chrome-extension` folder located inside the `Team-9-Decentralized-Event-Participation-Badge-System` directory.
6. Make sure the extension is turned on.

## 4. Execute the End-to-End Flow!

1. In Chrome, navigate to any Luma event page, for example: `https://lu.ma/` or an actual event page.
2. You will see a glowing blue button at the bottom right corner of the screen: **Mint Badge (Simulate Registration)**.
3. Click the button!
4. The extension will scrape the page title, generate an Event ID, and notify your backend server.
5. Look at your **Terminal 3 (Backend)**. You will see logs indicating it received the request and is minting the badge.
6. Look at your **Terminal 1 (Hardhat)**. You will see the Ethereum transaction mined successfully.
7. Back in Chrome, a beautiful **Success Notification Overlay** will pop up, proving the badge was minted and sent to the dummy account `0x7099...79C8`.

---
**Congratulations! The end-to-end bridge is fully operational.**
