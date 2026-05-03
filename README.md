# Badge Pop

Decentralized event check-in, claim, and verification platform for attendance badges.

## Team - 9
- Chandra Shekhar Pavuluri
- Yuvraj Rasal
- Siddanagouda Patil
- Sai Manaswi Seela
- Harshit Kumar Metpally

## Overview
Badge Pop currently supports this flow:

1. A guest RSVPs on Luma.
2. The Chrome extension captures that registration and sends it to the local backend.
3. The backend emails the guest a QR-based check-in pass.
4. Staff scan the QR code at the event.
5. Check-in triggers the badge claim email.
6. The guest signs in or creates an account in the Claim Portal.
7. The backend provisions a wallet for that account.
8. The guest mints a soulbound attendance badge.
9. Anyone can verify the badge on-chain from the public verification page.

## Project Structure
- `/backend`: Express backend, static frontend pages, email flow, account flow, QR generation, claim logic
- `/contracts`: Solidity smart contract
- `/scripts`: Hardhat deployment script
- `/test`: Contract tests
- `/chrome-extension`: Luma registration bridge

## Prerequisites
- Node.js and npm
- Google Chrome
- A Gmail account if you want to send real emails

## Install

### 1. Install root dependencies
```bash
npm install
```

### 2. Install backend dependencies
```bash
cd backend
npm install
cd ..
```

## Environment Setup

### 1. Create the backend env file
```bash
cp backend/.env.example backend/.env
```

### 2. Fill in these values in `backend/.env`

Required for local blockchain and minting:
- `PORT=3001`
- `BASE_URL=http://localhost:3001`
- `SESSION_SECRET=replace-this-in-production`
- `RPC_URL=http://127.0.0.1:8545`
- `PRIVATE_KEY=<hardhat account #0 private key>`
- `CONTRACT_ADDRESS=<deployed ParticipationBadge contract address>`
- `DUMMY_ACCOUNT_ADDRESS=<hardhat account #1 address>`

Optional event overrides:
- `EVENT_NAME=Badge Pop`
- `EVENT_ID=evt-your-event-id`

 email delivery settings:
- `EMAIL_FROM="Badge Pop <yourgmail@gmail.com>"`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=yourgmail@gmail.com`
- `SMTP_PASS=your16characterapppassword`

Notes:
- The backend reads both `backend/.env` and the repo-root `.env`. If the same variable exists in both places, `backend/.env` is the easiest place to manage your local setup.
- If SMTP is not configured, the app still works in preview mode and stores local HTML email previews in `backend/data/email-previews/`.

## Gmail SMTP Setup

Badge Pop uses Nodemailer with Gmail SMTP.

### 1. Turn on 2-Step Verification
Google requires 2-Step Verification before you can create an App Password:
- https://support.google.com/mail/answer/185833?hl=en-GB

### 2. Create a Gmail App Password
Use a 16-character App Password for `SMTP_PASS`:
- https://support.google.com/mail/answer/185833?hl=en-GB
- https://support.google.com/accounts/answer/2461835?hl=en

### 3. Use these Gmail values
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your16characterapppassword
EMAIL_FROM="Badge Pop <yourgmail@gmail.com>"
```

Important:
- Use the App Password, not your normal Gmail password.
- If you change your Google account password later, Google may revoke existing App Passwords. Generate a new one if mail stops working.
- Some work, school, or advanced-protection accounts may not expose App Passwords.

## Local Blockchain Setup

### 1. Start Hardhat
From the repo root:
```bash
npx hardhat node
```

Keep that terminal running.

### 2. Deploy the contract
In a new terminal from the repo root:
```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract address and paste it into:
```env
CONTRACT_ADDRESS=0x...
```

## Start the Backend

From the backend folder:
```bash
cd backend
npm start
```

The app runs at:
```text
http://localhost:3001/
```

Quick health check:
```bash
curl http://localhost:3001/api/health
```

## Load the Chrome Extension

### 1. Open Chrome extensions
In Google Chrome, go to:
```text
chrome://extensions/
```

### 2. Turn on Developer mode
Use the toggle in the top-right corner of the page.

### 3. Click `Load unpacked`
Chrome will open a folder picker.

### 4. Select the extension folder from this repo
Choose:
```text
Team-9-Decentralized-Event-Participation-Badge-System/chrome-extension
```

After you select it, Chrome should add the extension card to your extensions page.

### 5. Make sure the extension stays enabled
On the extension card:
- confirm the extension is turned on
- if Chrome shows an error, click into it before testing

### 6. Reload it after code changes
If you change anything inside `chrome-extension/`:
- go back to `chrome://extensions/`
- click `Reload` on the unpacked extension
- close old `luma.com` / `lu.ma` tabs
- open a fresh Luma tab

### 7. How to confirm the extension is working
Open a Luma event page in Chrome.

You should see the small Badge Pop indicator in the bottom-right corner of the page.

Typical states:
- `Badge Pop active` or `Email captured` means the extension loaded
- after RSVP, it should progress into the backend email flow

### 8. Backend must already be running
The extension sends registrations to:
```text
http://localhost:3001
```

So start the backend before testing:
```bash
cd backend
npm start
```

## End-to-End Local Flow

### 1. Open the dashboard
Visit:
```text
http://localhost:3001/
```

### 2. Register on Luma
- Open your Luma event page in Chrome.
- Make sure the Badge Pop extension is loaded.
- RSVP on the event page.

What should happen:
- The extension detects the attendee on the Luma page.
- After RSVP completes, it sends the registration to the backend.
- The backend sends the QR email automatically.

### 3. Check the staff scanner
Open:
```text
http://localhost:3001/staff
```

You can:
- Start the camera scanner
- Upload a QR screenshot
- Paste the fallback code manually

After a successful scan:
- The guest is marked checked in
- The claim email is sent automatically

### 4. Open the Claim Portal
Open the claim email link, or visit:
```text
http://localhost:3001/claim
```

Current Claim Portal flow:
- The first screen is the auth screen
- Guests can sign in
- Guests can create an account
- Guests can reset local account details with the reset action
- After successful sign-in or signup, the wallet, claim details, and minted badges appear

### 5. Mint and verify
After claiming, open:
```text
http://localhost:3001/verify/<tokenId>
```

## Useful URLs
- Dashboard: `http://localhost:3001/`
- Staff Scanner: `http://localhost:3001/staff`
- Claim Portal: `http://localhost:3001/claim`
- Verification: `http://localhost:3001/verify/<tokenId>`
- Health: `http://localhost:3001/api/health`

## Common Issues

### Backend port already in use
If `npm start` says `EADDRINUSE`, free the port and restart:
```bash
kill -9 $(lsof -tiTCP:3001 -sTCP:LISTEN)
cd backend
npm start
```

### No email arrives
Check:
- `SMTP_*` values in `backend/.env`
- Gmail App Password instead of your normal password
- Spam folder
- Backend terminal output after RSVP or check-in

If SMTP is missing or failing, the backend can still generate local preview emails.

### Extension loaded but no registration email is sent
Check:
- The backend is running on `http://localhost:3001`
- The extension was reloaded in `chrome://extensions`
- You opened a fresh Luma tab after reloading the extension

## Testing

Run the contract tests from the repo root:
```bash
npx hardhat test
```

## API Highlights
- `GET /api/dashboard`
- `GET /api/guests`
- `GET /api/emails`
- `POST /api/integrations/luma/register`
- `POST /api/check-in/scan`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/claims/refresh`
- `POST /api/claims/claim`
- `GET /api/badges/:tokenId/verify`
