/**
 * Parses the raw string that a QR scanner or manual-code entry produces into
 * a typed { type, value } descriptor consumed by the check-in endpoint.
 *
 *  • Custom deep-link  badgepop://check-in/<token>
 *  • HTTPS URL         https://…/check-in/<token>
 *  • HTTPS URL         https://…?token=<token>
 *  • Fallback code     Any plain uppercase string (e.g. "ABC123")
 */

/**
 * @param {string} rawValue - Raw scan output from a QR reader or typed input
 * @returns {{ type: "token" | "code", value: string } | null}
 *   Returns null when rawValue is empty/absent.
 */
function parseScannedValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  // Custom deep-link scheme produced by the Badge Pop mobile app.
  const customPrefix = "badgepop://check-in/";
  if (value.startsWith(customPrefix)) {
    return { type: "token", value: value.slice(customPrefix.length) };
  }

  // Standard HTTPS URL — try to extract the token from path or query string.
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const checkInIndex = segments.indexOf("check-in");

    if (checkInIndex !== -1 && segments[checkInIndex + 1]) {
      return { type: "token", value: segments[checkInIndex + 1] };
    }

    if (url.searchParams.get("token")) {
      return { type: "token", value: url.searchParams.get("token") };
    }
  } catch {
    // Not a URL — fall through to the manual-code path.
  }

  // Treat anything else as a human-readable fallback check-in code.
  return { type: "code", value: value.toUpperCase() };
}

module.exports = { parseScannedValue };
