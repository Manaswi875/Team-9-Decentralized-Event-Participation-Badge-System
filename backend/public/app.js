const authStorageKey = "badgepop-auth-token";

const pageState = {
  authToken: window.localStorage.getItem(authStorageKey),
  account: null,
  scanStream: null,
  scanTimer: null,
  detector: null,
};

function byId(id) {
  return document.getElementById(id);
}

function getClaimToken() {
  return new URLSearchParams(window.location.search).get("token");
}

function replaceClaimPageUrl(claimUrl) {
  const nextUrl = new URL(claimUrl, window.location.origin);
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
}

function formatDate(value) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setBanner(id, message, tone = "info") {
  const node = byId(id);
  if (!node) {
    return;
  }

  if (!message) {
    node.className = "banner";
    node.textContent = "";
    return;
  }

  node.className = `banner show ${tone}`;
  node.textContent = message;
}

async function apiRequest(url, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (pageState.authToken && !headers.Authorization && options.auth !== false) {
    headers.Authorization = `Bearer ${pageState.authToken}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const currentOrigin = window.location.origin;
    const likelyWrongOrigin =
      window.location.protocol === "file:" ||
      (window.location.protocol.startsWith("http") && window.location.port && window.location.port !== "3001");

    if (likelyWrongOrigin) {
      throw new Error(
        `Could not reach the backend API. Start the backend with "cd backend && npm start" and open the app at http://localhost:3001/. Current page origin: ${currentOrigin}.`,
      );
    }

    throw new Error(
      "Could not reach the backend API. Make sure the backend server is running and reload the page.",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload.details || payload.error || "Something went wrong.";
    throw new Error(message);
  }

  return payload;
}

function renderStatusChip(status) {
  if (status === "claimed") {
    return `<span class="status-chip status-success">Claimed</span>`;
  }

  if (status === "claimable") {
    return `<span class="status-chip status-warn">Ready To Claim</span>`;
  }

  return `<span class="status-chip status-neutral">Awaiting Check-In</span>`;
}

function renderApprovalChip(status) {
  if (status === "approved") {
    return `<span class="status-chip status-success">Approved</span>`;
  }

  return `<span class="status-chip status-danger">${escapeHtml(status || "Pending")}</span>`;
}

function applyEventMeta(event, platform) {
  document.querySelectorAll("[data-event-name]").forEach((node) => {
    node.textContent = event?.name || "Badge Pop Event";
  });

  document.querySelectorAll("[data-event-id]").forEach((node) => {
    node.textContent = event?.id || "unconfigured";
  });

  document.querySelectorAll("[data-delivery-mode]").forEach((node) => {
    node.textContent = platform?.deliveryMode || "preview";
  });

  document.querySelectorAll("[data-chain-status]").forEach((node) => {
    node.textContent = platform?.chainConfigured ? "Enabled" : "Not configured";
  });
}

function renderEmailList(emails) {
  const list = byId("emailList");
  if (!list) {
    return;
  }

  if (!emails.length) {
    list.innerHTML = `<div class="empty-state">Email previews will appear here after check-in or claim messages are sent.</div>`;
    return;
  }

  list.innerHTML = emails
    .map(
      (email) => `
        <div class="link-item">
          <p><strong>${escapeHtml(email.subject)}</strong></p>
          <p>${escapeHtml(email.to)} · ${formatDate(email.sentAt)}</p>
          <p>Mode: ${escapeHtml(email.deliveryMode)}</p>
          <p><a href="${email.previewUrl}" target="_blank" rel="noreferrer">Open preview</a></p>
        </div>
      `,
    )
    .join("");
}

function renderGuestRows(guests) {
  const body = byId("guestRows");
  if (!body) {
    return;
  }

  if (!guests.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">No guests exist for this event yet.</div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = guests
    .map(
      (guest) => `
        <tr>
          <td>
            <p class="row-title">${escapeHtml(guest.name)}</p>
            <p class="row-subtitle">${escapeHtml(guest.ticketName || "General Admission")}</p>
          </td>
          <td>
            <p class="row-title">${escapeHtml(guest.email)}</p>
            <p class="row-subtitle">${escapeHtml(guest.checkInCode)}</p>
          </td>
          <td>${renderApprovalChip(guest.approvalStatus)}</td>
          <td>
            <p class="row-title">${formatDate(guest.checkedInAt)}</p>
            <p class="row-subtitle"><a href="${guest.qrImageUrl}" target="_blank" rel="noreferrer">Open QR</a></p>
          </td>
          <td>
            ${renderStatusChip(guest.claimStatus)}
            <p class="row-subtitle">${guest.badgeTokenId ? `Token #${escapeHtml(guest.badgeTokenId)}` : "No badge yet"}</p>
          </td>
          <td>
            <p class="row-title">${guest.walletAddress ? escapeHtml(guest.walletAddress) : "No wallet yet"}</p>
            <p class="row-subtitle">${guest.verifyUrl ? `<a href="${guest.verifyUrl}" target="_blank" rel="noreferrer">Verify badge</a>` : "Verification link appears after mint"}</p>
          </td>
        </tr>
      `,
    )
    .join("");
}

async function loadDashboardPage() {
  const [dashboard, guestsPayload, emailsPayload] = await Promise.all([
    apiRequest("/api/dashboard", { auth: false }),
    apiRequest("/api/guests", { auth: false }),
    apiRequest("/api/emails", { auth: false }),
  ]);

  applyEventMeta(dashboard.event, dashboard.platform);

  const stats = dashboard.stats;
  const statsGrid = byId("statsGrid");
  if (statsGrid) {
    statsGrid.innerHTML = [
      ["Guests", stats.totalGuests, `${stats.approvedGuests} approved guests in the system`],
      ["Checked In", stats.checkedInGuests, `${stats.claimableGuests} guests are ready to claim`],
      ["Claimed Badges", stats.claimedBadges, `${stats.accountsCreated} platform accounts created`],
      ["Emails Sent", stats.registrationEmailCount + stats.claimEmailCount, `${stats.registrationEmailCount} check-in and ${stats.claimEmailCount} claim emails`],
    ]
      .map(
        ([label, value, note]) => `
          <div class="stat">
            <p class="stat-label">${label}</p>
            <p class="stat-value">${value}</p>
            <p class="stat-note">${note}</p>
          </div>
        `,
      )
      .join("");
  }

  const detailList = byId("platformDetails");
  if (detailList) {
    detailList.innerHTML = `
      <div class="detail-item"><span>Email mode</span><span>${escapeHtml(
        dashboard.platform.deliveryMode,
      )}</span></div>
      <div class="detail-item"><span>Blockchain claims</span><span>${dashboard.platform.chainConfigured ? "Enabled" : "Waiting for env config"}</span></div>
      <div class="detail-item"><span>Contract</span><span class="mono">${escapeHtml(
        dashboard.platform.contractAddress || "Not configured",
      )}</span></div>
    `;
  }

  const recentList = byId("recentCheckins");
  if (recentList) {
    if (!dashboard.recentCheckIns.length) {
      recentList.innerHTML = `<div class="empty-state">No one has checked in yet.</div>`;
    } else {
      recentList.innerHTML = dashboard.recentCheckIns
        .map(
          (guest) => `
            <div class="recent-item">
              <p class="row-title">${escapeHtml(guest.name)}</p>
              <p class="row-subtitle">${escapeHtml(guest.email)} · ${formatDate(guest.checkedInAt)}</p>
            </div>
          `,
        )
        .join("");
    }
  }

  renderGuestRows(guestsPayload.guests);
  renderEmailList(emailsPayload.emails);
}

function renderRecentCheckins(guests) {
  const list = byId("staffRecentCheckins");
  if (!list) {
    return;
  }

  const recent = [...guests]
    .filter((guest) => guest.checkedInAt)
    .sort((left, right) => new Date(right.checkedInAt) - new Date(left.checkedInAt))
    .slice(0, 8);

  if (!recent.length) {
    list.innerHTML = `<div class="empty-state">Scanned guests will appear here as soon as check-in begins.</div>`;
    return;
  }

  list.innerHTML = recent
    .map(
      (guest) => `
        <div class="recent-item">
          <p class="row-title">${escapeHtml(guest.name)}</p>
          <p class="row-subtitle">${escapeHtml(guest.email)} · ${formatDate(guest.checkedInAt)}</p>
        </div>
      `,
    )
    .join("");
}

async function loadStaffPage() {
  const [dashboard, guestsPayload] = await Promise.all([
    apiRequest("/api/dashboard", { auth: false }),
    apiRequest("/api/guests", { auth: false }),
  ]);

  applyEventMeta(dashboard.event, dashboard.platform);
  renderRecentCheckins(guestsPayload.guests);
}

async function submitCheckIn(scanData) {
  setBanner("staffBanner", "Checking in guest...", "info");

  try {
    const payload = await apiRequest("/api/check-in/scan", {
      method: "POST",
      body: { scanData },
      auth: false,
    });

    const card = byId("scanResult");
    if (card) {
      card.innerHTML = `
        <div class="badge-card">
          <p class="eyebrow" style="margin-bottom:12px;"><span class="dot"></span> Check-In Confirmed</p>
          <p class="row-title" style="font-size:1.35rem;">${escapeHtml(payload.guest.name)}</p>
          <p>${escapeHtml(payload.guest.email)}</p>
          <p>Claim email: ${payload.claimEmailSent ? "sent now" : "already sent earlier"}</p>
          <p>Claim link: <a href="${payload.claimUrl}" target="_blank" rel="noreferrer" style="color:#f6e4c7;">open</a></p>
        </div>
      `;
    }

    setBanner(
      "staffBanner",
      payload.alreadyCheckedIn
        ? `${payload.guest.name} was already checked in.`
        : `${payload.guest.name} checked in successfully.`,
      "success",
    );

    await loadStaffPage();
  } catch (error) {
    setBanner("staffBanner", error.message, "error");
  }
}

function stopCamera() {
  window.clearTimeout(pageState.scanTimer);
  pageState.scanTimer = null;

  if (pageState.scanStream) {
    pageState.scanStream.getTracks().forEach((track) => track.stop());
    pageState.scanStream = null;
  }
}

async function scanLoop(video) {
  if (!pageState.detector || !pageState.scanStream) {
    return;
  }

  try {
    const barcodes = await pageState.detector.detect(video);
    const match = barcodes.find((barcode) => barcode.rawValue);
    if (match) {
      stopCamera();
      await submitCheckIn(match.rawValue);
      return;
    }
  } catch (error) {
    setBanner("staffBanner", "Live scanning is running, but the browser could not decode that frame yet.", "warn");
  }

  pageState.scanTimer = window.setTimeout(() => scanLoop(video), 400);
}

async function startCamera() {
  const video = byId("cameraVideo");
  const placeholder = byId("cameraPlaceholder");

  if (!("BarcodeDetector" in window)) {
    setBanner(
      "staffBanner",
      "This browser does not expose BarcodeDetector. Use the fallback code field or image upload instead.",
      "warn",
    );
    return;
  }

  try {
    pageState.detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    pageState.scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    video.srcObject = pageState.scanStream;
    await video.play();
    video.hidden = false;
    placeholder.hidden = true;
    setBanner("staffBanner", "Camera ready. Hold the attendee email QR inside the frame.", "info");
    scanLoop(video);
  } catch (error) {
    setBanner("staffBanner", error.message, "error");
  }
}

async function scanUploadedImage(file) {
  if (!("BarcodeDetector" in window)) {
    setBanner("staffBanner", "Image scanning is not supported in this browser.", "warn");
    return;
  }

  try {
    pageState.detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const image = await createImageBitmap(file);
    const barcodes = await pageState.detector.detect(image);
    const match = barcodes.find((barcode) => barcode.rawValue);

    if (!match) {
      throw new Error("No QR code was detected in that image.");
    }

    await submitCheckIn(match.rawValue);
  } catch (error) {
    setBanner("staffBanner", error.message, "error");
  }
}

function renderClaimContext(payload) {
  const panel = byId("claimContext");
  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Guest</span><span>${escapeHtml(payload.guest.name)}</span></div>
      <div class="detail-item"><span>Email</span><span>${escapeHtml(payload.guest.email)}</span></div>
      <div class="detail-item"><span>Status</span><span>${payload.guest.claimStatus.replaceAll("-", " ")}</span></div>
      <div class="detail-item"><span>Checked in</span><span>${formatDate(payload.guest.checkedInAt)}</span></div>
      <div class="detail-item"><span>Fallback code</span><span>${escapeHtml(payload.guest.checkInCode)}</span></div>
    </div>
  `;
}

async function loadClaimContext(token) {
  if (!token) {
    const panel = byId("claimContext");
    if (panel) {
      panel.innerHTML =
        "Open this page from a claim email to load the attendee context automatically.";
    }
    return null;
  }

  const payload = await apiRequest(`/api/claims/context?token=${encodeURIComponent(token)}`, {
    auth: false,
  });
  renderClaimContext(payload);
  return payload;
}

function renderAccount(account) {
  const wrap = byId("accountState");
  const claimButton = byId("claimBadgeButton");
  const claimRefreshCard = byId("claimRefreshCard");

  pageState.account = account || null;

  if (!wrap) {
    return;
  }

  if (!account) {
    wrap.innerHTML = `<div class="empty-state">Create an account or sign in with the same email address that received the claim link. A wallet address will be provisioned automatically.</div>`;
    if (claimButton) {
      claimButton.disabled = true;
    }
    if (claimRefreshCard) {
      claimRefreshCard.hidden = true;
    }
    return;
  }

  wrap.innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Email</span><span>${escapeHtml(account.email)}</span></div>
      <div class="detail-item"><span>Wallet</span><span class="mono">${escapeHtml(account.walletAddress)}</span></div>
      <div class="detail-item"><span>Account created</span><span>${formatDate(account.createdAt)}</span></div>
    </div>
  `;

  if (claimButton) {
    claimButton.disabled = false;
  }
  if (claimRefreshCard) {
    claimRefreshCard.hidden = false;
  }

  const badgeGrid = byId("badgeList");
  if (!badgeGrid) {
    return;
  }

  if (!account.badges.length) {
    badgeGrid.innerHTML = `<div class="empty-state">No badges have been minted to this wallet yet.</div>`;
    return;
  }

  badgeGrid.innerHTML = account.badges
    .map(
      (badge) => `
        <div class="badge-card">
          <p class="eyebrow" style="margin-bottom:12px;"><span class="dot"></span> Soulbound Badge</p>
          <p class="row-title" style="font-size:1.5rem;">Token #${escapeHtml(badge.tokenId)}</p>
          <p>${escapeHtml(badge.eventName)}</p>
          <p>Claimed ${formatDate(badge.claimedAt)}</p>
          <p><a href="${badge.verifyUrl}" target="_blank" rel="noreferrer" style="color:#f6e4c7;">Open verification page</a></p>
        </div>
      `,
    )
    .join("");
}

async function loadAuthState() {
  if (!pageState.authToken) {
    renderAccount(null);
    return null;
  }

  try {
    const payload = await apiRequest("/api/auth/me");
    renderAccount(payload.account);
    return payload.account;
  } catch (error) {
    pageState.authToken = null;
    window.localStorage.removeItem(authStorageKey);
    renderAccount(null);
    return null;
  }
}

async function submitRegister(event) {
  event.preventDefault();
  const email = byId("registerEmail").value;
  const password = byId("registerPassword").value;

  setBanner("claimBanner", "Creating account and wallet...", "info");

  try {
    const payload = await apiRequest("/api/auth/register", {
      method: "POST",
      body: { email, password },
      auth: false,
    });

    pageState.authToken = payload.authToken;
    window.localStorage.setItem(authStorageKey, payload.authToken);
    renderAccount(payload.account);
    setBanner("claimBanner", "Account created. Your wallet is ready for badge claims.", "success");
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const email = byId("loginEmail").value;
  const password = byId("loginPassword").value;

  setBanner("claimBanner", "Signing in...", "info");

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });

    pageState.authToken = payload.authToken;
    window.localStorage.setItem(authStorageKey, payload.authToken);
    renderAccount(payload.account);
    setBanner("claimBanner", "Signed in successfully.", "success");
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function submitForgotPassword(event) {
  event.preventDefault();
  const email = byId("forgotPasswordEmail").value;

  setBanner("claimBanner", "Removing stored account details for that email...", "info");

  try {
    const payload = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });

    if (pageState.account?.email === String(email || "").trim().toLowerCase()) {
      pageState.authToken = null;
      window.localStorage.removeItem(authStorageKey);
      renderAccount(null);
    }

    setBanner("claimBanner", payload.message, "success");
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function submitClaimRefresh(event) {
  event.preventDefault();
  const claimToken = getClaimToken();
  const currentPassword = byId("claimRefreshPassword")?.value || "";

  setBanner("claimBanner", "Refreshing the claim flow for another test...", "info");

  try {
    const payload = await apiRequest("/api/claims/refresh", {
      method: "POST",
      body: { claimToken, currentPassword },
    });

    if (payload.account) {
      renderAccount(payload.account);
    }

    if (payload.claimUrl) {
      replaceClaimPageUrl(payload.claimUrl);
      await loadClaimContext(getClaimToken());
    }

    const resetNote =
      payload.resetMode === "burned-on-chain"
        ? "The previous badge was burned on-chain."
        : payload.resetMode === "rotated-wallet"
          ? "A fresh demo wallet was provisioned for another mint."
          : "The local claim state was refreshed.";

    setBanner(
      "claimBanner",
      `${resetNote} ${payload.claimEmailSent ? "A fresh claim email was sent." : "Use the updated claim link on this page."}`,
      "success",
    );

    const passwordField = byId("claimRefreshPassword");
    if (passwordField) {
      passwordField.value = "";
    }
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function submitClaim() {
  const token = getClaimToken();
  setBanner("claimBanner", "Minting your soulbound badge...", "info");

  try {
    const payload = await apiRequest("/api/claims/claim", {
      method: "POST",
      body: token ? { claimToken: token } : {},
    });

    if (payload.account) {
      renderAccount(payload.account);
    }

    setBanner(
      "claimBanner",
      payload.alreadyClaimed
        ? "This badge was already claimed earlier."
        : `Badge minted successfully. Verification page: ${window.location.origin}${payload.verifyUrl}`,
      "success",
    );
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function loadClaimPage() {
  const dashboard = await apiRequest("/api/dashboard", { auth: false });
  applyEventMeta(dashboard.event, dashboard.platform);
  await loadAuthState();

  const token = getClaimToken();

  if (!token) {
    setBanner(
      "claimBanner",
      "Open this page from a claim email link, or sign in to inspect your existing badges.",
      "warn",
    );
    return;
  }

  try {
    await loadClaimContext(token);
  } catch (error) {
    setBanner("claimBanner", error.message, "error");
  }
}

async function loadVerifyPage() {
  const tokenId = window.location.pathname.split("/").filter(Boolean).pop();
  const tokenField = byId("verifyTokenId");
  if (tokenField) {
    tokenField.value = tokenId || "";
  }

  try {
    const dashboard = await apiRequest("/api/dashboard", { auth: false });
    applyEventMeta(dashboard.event, dashboard.platform);
  } catch (error) {
    // Leave event placeholders if health is unavailable.
  }

  if (!tokenId || Number.isNaN(Number(tokenId))) {
    setBanner("verifyBanner", "Enter a token ID to verify a badge on-chain.", "info");
    return;
  }

  setBanner("verifyBanner", "Verifying badge against the blockchain...", "info");

  try {
    const payload = await apiRequest(`/api/badges/${encodeURIComponent(tokenId)}/verify`, {
      auth: false,
    });
    const badge = payload.badge;
    const detail = byId("verifyDetails");
    if (detail) {
      detail.innerHTML = `
        <div class="verify-grid">
          <p class="large-number">#${escapeHtml(badge.tokenId)}</p>
          <div class="detail-list">
            <div class="detail-item"><span>Owner wallet</span><span class="mono">${escapeHtml(badge.owner)}</span></div>
            <div class="detail-item"><span>On-chain event id</span><span>${escapeHtml(badge.eventId)}</span></div>
            <div class="detail-item"><span>Event name</span><span>${escapeHtml(payload.event.name)}</span></div>
            <div class="detail-item"><span>Issued to</span><span>${escapeHtml(badge.attendeeName || "Unknown attendee")}</span></div>
            <div class="detail-item"><span>Claimed at</span><span>${formatDate(badge.claimedAt)}</span></div>
            <div class="detail-item"><span>Transaction</span><span class="mono">${escapeHtml(badge.txHash || "Unavailable")}</span></div>
            <div class="detail-item"><span>Contract</span><span class="mono">${escapeHtml(badge.contractAddress)}</span></div>
          </div>
        </div>
      `;
    }

    setBanner("verifyBanner", "Badge verified successfully on-chain.", "success");
  } catch (error) {
    setBanner("verifyBanner", error.message, "error");
  }
}

function initDashboardPage() {
  loadDashboardPage().catch((error) => setBanner("dashboardBanner", error.message, "error"));
}

function initStaffPage() {
  loadStaffPage().catch((error) => setBanner("staffBanner", error.message, "error"));
  byId("startCamera")?.addEventListener("click", startCamera);
  byId("manualCheckInForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = byId("manualCheckInValue").value.trim();
    if (!value) {
      setBanner("staffBanner", "Enter a fallback code or scanned payload.", "warn");
      return;
    }
    submitCheckIn(value);
  });
  byId("scanUpload")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      scanUploadedImage(file);
    }
  });
}

function initClaimPage() {
  loadClaimPage().catch((error) => setBanner("claimBanner", error.message, "error"));
  byId("registerForm")?.addEventListener("submit", submitRegister);
  byId("loginForm")?.addEventListener("submit", submitLogin);
  byId("forgotPasswordForm")?.addEventListener("submit", submitForgotPassword);
  byId("claimRefreshForm")?.addEventListener("submit", submitClaimRefresh);
  byId("claimBadgeButton")?.addEventListener("click", submitClaim);
}

function initVerifyPage() {
  loadVerifyPage().catch((error) => setBanner("verifyBanner", error.message, "error"));
  byId("verifyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const tokenId = byId("verifyTokenId").value.trim();
    if (!tokenId) {
      setBanner("verifyBanner", "Enter a token ID.", "warn");
      return;
    }
    window.location.href = `/verify/${encodeURIComponent(tokenId)}`;
  });
}

window.addEventListener("beforeunload", stopCamera);

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "dashboard") {
    initDashboardPage();
  } else if (page === "staff") {
    initStaffPage();
  } else if (page === "claim") {
    initClaimPage();
  } else if (page === "verify") {
    initVerifyPage();
  }
});
