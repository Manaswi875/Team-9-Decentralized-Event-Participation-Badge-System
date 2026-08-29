const crypto = require("crypto");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString("hex");
}

function createCheckInCode() {
  return `BP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);

  return {
    salt,
    hash: derivedKey.toString("hex"),
  };
}

async function verifyPassword(password, passwordSalt, passwordHash) {
  const derivedKey = await scryptAsync(password, passwordSalt);
  const expected = Buffer.from(passwordHash, "hex");

  if (expected.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, derivedKey);
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSessionToken(accountId, secret) {
  const payload = {
    accountId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signPayload(encodedPayload, secret);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

module.exports = {
  createCheckInCode,
  createId,
  createSessionToken,
  createToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
  verifySessionToken,
};
