# Badge Pop

Event check-in and on-chain badge system. Attendees RSVP on Luma, get checked in at the door via QR code, and mint a soulbound ERC-721 token as proof of attendance.

## Team 9

- Chandra Shekhar Pavuluri
- Yuvraj Rasal
- Siddanagouda Patil
- Sai Manaswi Seela
- Harshit Kumar Metpally

## How it works

A Chrome extension watches Luma event pages and forwards each RSVP to the local server. The server emails the guest a QR check-in pass. Staff scan the QR at the door — that marks the guest as checked in and triggers a claim email. The guest opens the Claim Portal, creates an account, and mints their badge. The server provisions a custodial Ethereum wallet per account and calls `mintBadge` on their behalf. Badges are soulbound: the contract blocks all transfers after minting.

```
Luma RSVP → Chrome extension → POST /api/integrations/luma/register
                                         ↓
                                  QR check-in email sent
                                         ↓
                              Staff scan at POST /api/check-in/scan
                                         ↓
                                  Claim email sent
                                         ↓
                             Guest registers → wallet provisioned
                                         ↓
                                  Badge minted on Base
```

## Project Structure

```
/backend          Express server, static frontend pages, email, auth, claim logic
/contracts        Solidity ERC-721 soulbound token (ParticipationBadge.sol)
/scripts          Hardhat deploy script
/test             Contract tests
/chrome-extension Luma registration bridge (content script)
```

## Prerequisites

- Node.js and npm
- Google Chrome (for the extension)
- A Gmail account with an App Password if you want real email delivery

## Setup

### Install dependencies

```bash
npm install              # Hardhat toolchain (repo root)
cd backend && npm install
```

### Environment

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

| Variable                | Notes                                               |
| ----------------------- | --------------------------------------------------- |
| `PORT`                  | Default `3001`                                      |
| `BASE_URL`              | Default `http://localhost:3001`                     |
| `SESSION_SECRET`        | Any random string; change in production             |
| `RPC_URL`               | `http://127.0.0.1:8545` for local Hardhat node      |
| `PRIVATE_KEY`           | Deployer wallet key — Hardhat account #0 by default |
| `CONTRACT_ADDRESS`      | From the deploy script output                       |
| `DUMMY_ACCOUNT_ADDRESS` | Hardhat account #1 (local testing only)             |

Without `RPC_URL`, `PRIVATE_KEY`, and `CONTRACT_ADDRESS`, the server starts fine but claim endpoints return 503.

The server reads both `backend/.env` and the repo-root `.env`. `backend/.env` takes precedence when a variable appears in both.

### Gmail SMTP (optional)

Add these to `backend/.env`. Use a [Gmail App Password](https://support.google.com/mail/answer/185833), not your account password.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your16characterapppassword
EMAIL_FROM="Badge Pop <yourgmail@gmail.com>"
```

Without SMTP configured, the server writes email previews as HTML files to `backend/data/email-previews/` and logs their paths.

Alternatively, set `RESEND_API_KEY` to use the Resend API instead of SMTP.

### Local blockchain

```bash
# Terminal 1 — keep this running
npx hardhat node

# Terminal 2
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract address into `CONTRACT_ADDRESS` in `backend/.env`. The Hardhat node pre-fills `PRIVATE_KEY` and `DUMMY_ACCOUNT_ADDRESS` in `.env.example` with its default test accounts.

## Running

```bash
cd backend && npm start
```

Health check: `curl http://localhost:3001/api/health`

## Chrome Extension

1. Go to `chrome://extensions/` and enable Developer mode
2. Click **Load unpacked** → select the `chrome-extension/` folder
3. Open a Luma event page — the Badge Pop status indicator appears in the bottom-right corner

The extension posts to `http://localhost:3001`, so start the server first. After any code change to the extension, reload it from `chrome://extensions/` and open a fresh Luma tab.

## End-to-End Flow

| Step                     | URL                                      |
| ------------------------ | ---------------------------------------- |
| Dashboard / email outbox | `http://localhost:3001/`                 |
| Staff QR scanner         | `http://localhost:3001/staff`            |
| Guest claim portal       | `http://localhost:3001/claim`            |
| Badge verification       | `http://localhost:3001/verify/<tokenId>` |
| Health check             | `http://localhost:3001/api/health`       |

1. With the server running and extension loaded, RSVP on a Luma event page. The extension detects the confirmation and POSTs the registration automatically.
2. Open the staff scanner and scan (or manually enter) the QR code from the check-in email.
3. Open the claim link from the claim email, create an account, and mint the badge.
4. Verify the token on-chain at `/verify/<tokenId>`.

## API

| Method | Endpoint                          | Description                                                                                        |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                     | Server status, email delivery mode, and whether blockchain is configured                           |
| GET    | `/api/dashboard`                  | Aggregated stats (guests, check-ins, claims) and recent activity for the staff dashboard           |
| GET    | `/api/guests`                     | Full guest list with check-in and claim status for each attendee                                   |
| GET    | `/api/emails`                     | Last 50 sent email records with delivery metadata                                                  |
| POST   | `/api/integrations/luma/register` | Receives RSVP payloads from the Chrome extension and sends the QR check-in email                   |
| POST   | `/api/check-in/scan`              | Validates a QR scan or manual fallback code, marks the guest checked in, and sends the claim email |
| POST   | `/api/auth/register`              | Creates an account and provisions a custodial Ethereum wallet encrypted with the user's password   |
| POST   | `/api/auth/login`                 | Verifies credentials and returns a session token                                                   |
| POST   | `/api/auth/forgot-password`       | Removes the account so the user can re-register with the same email (badge claims are preserved)   |
| GET    | `/api/auth/me`                    | Returns the authenticated account, linked guest record, and minted badges                          |
| POST   | `/api/claims/claim`               | Mints the soulbound badge to the account's wallet (requires check-in)                              |
| POST   | `/api/claims/refresh`             | Burns the existing badge and resets the claim flow for re-testing                                  |
| GET    | `/api/badges/:tokenId/verify`     | Reads badge ownership and event ID directly from the contract                                      |

## Contract Tests

```bash
npx hardhat test
```

## Troubleshooting

**Port already in use**

```bash
kill -9 $(lsof -tiTCP:3001 -sTCP:LISTEN)
```

**No email arrives** — verify `SMTP_PASS` is a Gmail App Password (not your login password). Check the server terminal output after RSVP or check-in. If SMTP isn't configured, previews land in `backend/data/email-previews/`.

**Extension not capturing RSVPs** — reload it in `chrome://extensions/` and open a fresh Luma tab. The server must be running before the extension fires.
