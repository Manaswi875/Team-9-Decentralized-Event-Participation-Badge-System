const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

const BACKEND_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BACKEND_DIR, "..");
const DATA_DIR = path.join(BACKEND_DIR, "data");
const EMAIL_PREVIEW_DIR = path.join(DATA_DIR, "email-previews");
const PUBLIC_DIR = path.join(BACKEND_DIR, "public");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function readOptionalEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function readOptionalBooleanEnv(name) {
  const value = readOptionalEnv(name);
  if (value == null) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function readNumberEnv(name, fallback) {
  const value = readOptionalEnv(name);
  if (value == null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PORT = readNumberEnv("PORT", 3001);
const SMTP_HOST = readOptionalEnv("SMTP_HOST");
const SMTP_USER = readOptionalEnv("SMTP_USER");
const SMTP_PASS = readOptionalEnv("SMTP_PASS");
const SMTP_PORT = readNumberEnv("SMTP_PORT", 587);
const SMTP_SECURE = readOptionalBooleanEnv("SMTP_SECURE") ?? SMTP_PORT === 465;
const RESEND_API_KEY =
  readOptionalEnv("RESEND_API_KEY") ||
  ((SMTP_HOST && /resend\.com$/i.test(SMTP_HOST)) || SMTP_USER?.toLowerCase() === "resend"
    ? SMTP_PASS
    : null);

module.exports = {
  BACKEND_DIR,
  ROOT_DIR,
  DATA_DIR,
  EMAIL_PREVIEW_DIR,
  PUBLIC_DIR,
  STORE_FILE,
  PORT,
  BASE_URL: process.env.BASE_URL || `http://localhost:${PORT}`,
  SESSION_SECRET:
    process.env.SESSION_SECRET ||
    process.env.PRIVATE_KEY ||
    "badgepop-dev-session-secret",
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || null,
  RPC_URL: process.env.RPC_URL || process.env.BASE_RPC_URL || null,
  PRIVATE_KEY: process.env.PRIVATE_KEY || null,
  DUMMY_ACCOUNT_ADDRESS: process.env.DUMMY_ACCOUNT_ADDRESS || null,
  EMAIL_FROM: readOptionalEnv("EMAIL_FROM") || "Badge Pop <noreply@badgepop.local>",
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EVENT_NAME_OVERRIDE: process.env.EVENT_NAME || null,
  EVENT_ID_OVERRIDE: process.env.EVENT_ID || null,
};
