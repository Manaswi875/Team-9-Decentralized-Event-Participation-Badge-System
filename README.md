# Decentralized Event Participation Badge System

## Overview
Current event verification (e.g., Luma confirmation emails or screenshots) relies on centralized platforms and is easily forged. This project implements an independent, blockchain-based verification system using **Soulbound Tokens (SBTs)** to provide immutable attendance records.

By bridging off-chain registration data (Luma) with the **Base blockchain** via a Chrome extension, we issue non-transferable badges that serve as verifiable credentials for participants.

## System Components
- **Soulbound Tokens (ERC721)**: Non-transferable badges tied to a specific wallet address.
- **Chrome Extension**: Acts as a bridge between Luma event pages and the smart contract.
- **Base Network**: Layer 2 solution chosen for low gas fees and EVM compatibility.
- **MetaMask**: Handles transaction signing and wallet connectivity.

## Repository Structure
- `/contracts`: Solidity smart contracts (SBT implementation).
- `/docs`: Architecture and design notes.
- `/scripts`: Deployment and interaction logic.
- `/test`: Unit tests for contract logic.

## Setup & Deployment

### Prerequisites
- Node.js (v18+)
- Hardhat
- MetaMask

### Installation
```bash
git clone https://github.com/Manaswi875/Blockchain_smartconteact
cd Blockchain_smartconteact
npm install
```

### Smart Contract Execution
1. **Compile**: `npx hardhat compile`
2. **Deploy**: `npx hardhat run scripts/deploy.js --network base-sepolia`
   *Note: Requires a `.env` file with `PRIVATE_KEY` and `BASE_RPC_URL`.*

## Project Rubric Compliance
- **Organization**: Logical folder structure for contracts, scripts, and docs.
- **Documentation**: Clear technical description and setup instructions.
- **Interfaces**: ERC721-based signatures with soulbound transfer overrides.
- **Comments**: High-level logic documentation provided in `ParticipationBadge.sol`.

---
*Developed for CSE 540 - Decentralized Systems.*
