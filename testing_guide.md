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
   *(It should display the local platform startup logs and confirm the email delivery mode.)*

## 3. Load the Chrome Extension

1. Open Google Chrome.
2. Go to the address bar and type `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `chrome-extension` folder located inside the `Team-9-Decentralized-Event-Participation-Badge-System` directory.
6. Make sure the extension is turned on.

## 4. Execute the End-to-End Flow!

1. In Chrome, navigate to the real Luma event page you want to use for registration.
2. Complete the normal Luma registration form with a test attendee email address.
3. The extension will watch the form submission, wait for Luma to show a confirmed registration state, and then call your backend automatically.
4. A floating Badge Pop status card should appear in the bottom-right corner confirming that the attendee's check-in QR email was sent.
5. Open your backend dashboard at `http://localhost:3001/` and confirm the guest appears in the registry and the email outbox.
6. Open the attendee's email inbox and use the QR code from the check-in email.
7. At the event check-in flow, open `http://localhost:3001/staff` and scan that QR code.
8. The backend will send the claim email automatically after a successful scan.
9. Open the claim link, create an account or sign in, and mint the badge.
10. If blockchain claims are enabled, verify the token at `http://localhost:3001/verify/<tokenId>`.

---
**Congratulations! The extension now drives the full Luma registration into QR email, check-in, claim, and badge minting flow.**
