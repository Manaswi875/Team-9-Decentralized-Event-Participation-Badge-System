(function () {
  const BACKEND_ORIGIN = "http://localhost:3001";
  const PANEL_ID = "badgepop-luma-bridge-panel";
  const PANEL_MESSAGE_ID = "badgepop-luma-bridge-message";
  const PANEL_ACTION_ID = "badgepop-luma-bridge-action";
  const INDICATOR_ID = "badgepop-luma-bridge-indicator";
  const INDICATOR_LABEL_ID = "badgepop-luma-bridge-indicator-label";
  const PENDING_KEY = "badgepop-pending-registration";
  const PENDING_TTL_MS = 1000 * 60 * 15;
  const CAPTURE_COOLDOWN_MS = 4000;
  const OBSERVER_THROTTLE_MS = 250;
  const IDLE_SCAN_INTERVAL_MS = 10000;
  const GENERIC_PAGE_SEGMENTS = new Set([
    "home",
    "discover",
    "events",
    "event",
    "calendar",
    "calendars",
    "manage",
    "ticket",
    "tickets",
    "settings",
    "notifications",
  ]);

  const SUCCESS_PHRASES = [
    "you're going",
    "you’re going",
    "you are going",
    "youre going",
    "you're registered",
    "you’re registered",
    "you are registered",
    "youre registered",
    "registration confirmed",
    "see you there",
    "you are in",
    "you're in",
    "you’re in",
    "youre in",
    "ticket confirmed",
  ];
  const POST_REGISTRATION_PHRASES = [
    "add to calendar",
    "invite a friend",
    "get ready for the event",
    "profile complete",
    "reminder: email",
    "manage registration",
    "starting in",
  ];

  const REGISTRATION_CTA_PATTERN = /\b(register|join|rsvp|reserve|get ticket|request to join)\b/i;
  const MAYBE_REGISTRATION_CTA_PATTERN = /\b(confirm|continue)\b/i;
  const CANCELLATION_PATTERN =
    /\b(cancel registration|cancel|dismiss|delete|remove|decline|can't make it|can’t make it|no longer able to attend|notify the host)\b/i;
  const EXTENSION_STATUS_PATTERN =
    /\b(badge pop|guest details captured|email captured|badge pop found|rsvp captured|you'?re in detected|sending qr email|check-in qr email sent to|this registration was already linked earlier|claim their token)\b/i;
  const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

  let bridgeInFlight = false;
  let lastCaptureSignature = null;
  let lastCaptureAt = 0;
  let currentUrl = window.location.href;
  let currentPageSentSignature = "";
  let observerTimer = null;
  let pendingRegistrationKnown = false;
  let lastDraftSignature = "";
  let draftAttendee = {
    email: "",
    firstName: "",
    lastName: "",
    name: "",
    phoneNumber: "",
  };

  function clearDraftAttendee() {
    draftAttendee = {
      email: "",
      firstName: "",
      lastName: "",
      name: "",
      phoneNumber: "",
    };
    lastDraftSignature = "";
  }

  function safeString(value) {
    try {
      if (value == null) {
        return "";
      }

      return String(value);
    } catch (error) {
      return "";
    }
  }

  function isContextInvalidatedError(error) {
    return /Extension context invalidated/i.test(safeString(error && error.message ? error.message : error));
  }

  function getStorageArea() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function storageGet(keys) {
    const storageArea = getStorageArea();
    const result = {};

    if (!storageArea) {
      return Promise.resolve(result);
    }

    for (const key of Array.isArray(keys) ? keys : [keys]) {
      try {
        const rawValue = storageArea.getItem(key);
        if (rawValue == null) {
          continue;
        }

        result[key] = JSON.parse(rawValue);
      } catch (error) {
        result[key] = null;
      }
    }

    return Promise.resolve(result);
  }

  function storageSet(value) {
    const storageArea = getStorageArea();
    if (!storageArea) {
      return Promise.resolve(false);
    }

    try {
      for (const [key, entry] of Object.entries(value || {})) {
        storageArea.setItem(key, JSON.stringify(entry));
      }

      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function storageRemove(keys) {
    try {
      const storageArea = getStorageArea();
      if (!storageArea) {
        return Promise.resolve(false);
      }

      for (const key of Array.isArray(keys) ? keys : [keys]) {
        storageArea.removeItem(key);
      }

      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function slugify(value) {
    let text = safeString(value).toLowerCase();
    text = text.replace(/[^a-z0-9]+/g, "-");
    text = text.replace(/^-+|-+$/g, "");

    return text.substring(0, 48);
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  function describeField(input) {
    let labelText = "";

    if (input.closest("label")) {
      labelText = input.closest("label").textContent || "";
    } else if (input.id) {
      try {
        const linkedLabel = document.querySelector(`label[for="${input.id.replace(/"/g, '\\"')}"]`);
        labelText = linkedLabel ? linkedLabel.textContent || "" : "";
      } catch (error) {
        labelText = "";
      }
    }

    return [
      input.name,
      input.id,
      input.placeholder,
      input.autocomplete,
      input.getAttribute("aria-label"),
      input.getAttribute("data-testid"),
      labelText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function listInputs(root) {
    if (!root?.querySelectorAll) {
      return [];
    }

    return Array.from(root.querySelectorAll("input, textarea"));
  }

  function queryFirstInput(root, predicate) {
    return listInputs(root).find(predicate) || null;
  }

  function getInputValue(input) {
    return safeString(input && input.value).trim();
  }

  function normalizeWhitespace(value) {
    return safeString(value).replace(/\s+/g, " ").trim();
  }

  function getClickableLabel(clickable) {
    return normalizeWhitespace(
      clickable?.innerText || clickable?.value || clickable?.getAttribute("aria-label") || "",
    );
  }

  function getNodeText(node) {
    return normalizeWhitespace(node?.innerText || node?.textContent || "");
  }

  function detectFieldKind(input) {
    const descriptor = describeField(input);
    const type = safeString(input?.type).toLowerCase();
    const autocomplete = safeString(input?.autocomplete).toLowerCase();

    if (
      type === "email" ||
      autocomplete === "email" ||
      descriptor.includes("email")
    ) {
      return "email";
    }

    if (
      autocomplete === "given-name" ||
      /\bfirst\b/.test(descriptor)
    ) {
      return "firstName";
    }

    if (
      autocomplete === "family-name" ||
      /\blast\b/.test(descriptor)
    ) {
      return "lastName";
    }

    if (
      autocomplete === "name" ||
      /\bfull name\b/.test(descriptor) ||
      (/\bname\b/.test(descriptor) && !/\b(first|last|email|ticket)\b/.test(descriptor))
    ) {
      return "name";
    }

    if (
      autocomplete === "tel" ||
      /\b(phone|mobile)\b/.test(descriptor)
    ) {
      return "phoneNumber";
    }

    return null;
  }

  function updateDraftAttendeeFromInput(input) {
    const kind = detectFieldKind(input);
    if (!kind) {
      return;
    }

    const value = getInputValue(input);
    if (!value) {
      return;
    }

    if (kind === "email") {
      draftAttendee.email = value.toLowerCase();
      return;
    }

    draftAttendee[kind] = value;

    if (kind === "name" && !draftAttendee.firstName && !draftAttendee.lastName) {
      const [derivedFirstName, ...remainingName] = value.split(/\s+/);
      draftAttendee.firstName = derivedFirstName || draftAttendee.firstName;
      draftAttendee.lastName = remainingName.join(" ").trim() || draftAttendee.lastName;
    }
  }

  function applyDraftAttendee(attendee) {
    if (!attendee?.email) {
      return false;
    }

    const nextDraftSignature = `${safeString(attendee.email).toLowerCase()}:${safeString(attendee.name)}`;
    if (nextDraftSignature === lastDraftSignature) {
      return true;
    }

    draftAttendee = {
      email: safeString(attendee.email).toLowerCase(),
      firstName: safeString(attendee.firstName),
      lastName: safeString(attendee.lastName),
      name: safeString(attendee.name),
      phoneNumber: safeString(attendee.phoneNumber),
    };
    lastDraftSignature = nextDraftSignature;

    return true;
  }

  function deriveNameFromEmail(email) {
    const localPart = safeString(email).split("@")[0] || "";
    const pieces = localPart
      .split(/[._+-]+/)
      .map((piece) => piece.replace(/[^a-z0-9]/gi, ""))
      .filter(Boolean)
      .slice(0, 3);

    if (!pieces.length) {
      return "Guest";
    }

    return pieces
      .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
      .join(" ");
  }

  function splitName(name) {
    const cleanName = normalizeWhitespace(name).replace(/^[^a-z0-9]+/i, "").trim();
    const [firstName, ...remainingName] = cleanName.split(/\s+/).filter(Boolean);

    return {
      name: cleanName,
      firstName: firstName || "",
      lastName: remainingName.join(" ").trim(),
    };
  }

  function collectTextLines(root) {
    const lines = [];

    const scopeRoot = root === document ? document.body : root;
    if (!scopeRoot) {
      return lines;
    }

    if (scopeRoot.id === PANEL_ID || scopeRoot.id === INDICATOR_ID) {
      return lines;
    }

    let scopeText = "";
    if (typeof scopeRoot.cloneNode === "function") {
      const clone = scopeRoot.cloneNode(true);
      if (clone?.querySelector) {
        clone.querySelector(`#${PANEL_ID}`)?.remove();
        clone.querySelector(`#${INDICATOR_ID}`)?.remove();
      }
      scopeText = safeString(clone?.innerText || clone?.textContent || "");
    } else {
      scopeText = safeString(scopeRoot?.innerText || scopeRoot?.textContent || "");
    }

    for (const line of scopeText.split("\n")) {
      const normalizedLine = normalizeWhitespace(line);
      if (!normalizedLine) {
        continue;
      }

      lines.push(normalizedLine);
    }

    return lines;
  }

  function lineLooksLikeBridgeStatus(line) {
    return EXTENSION_STATUS_PATTERN.test(safeString(line).toLowerCase());
  }

  function nodeIsBridgeUi(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    if (node.id === PANEL_ID || node.id === INDICATOR_ID) {
      return true;
    }

    return Boolean(node.closest?.(`#${PANEL_ID}, #${INDICATOR_ID}`));
  }

  function getDocumentTextWithoutBridgeUi() {
    const scopeRoot = document.body;
    if (!scopeRoot) {
      return "";
    }

    if (typeof scopeRoot.cloneNode === "function") {
      const clone = scopeRoot.cloneNode(true);
      if (clone?.querySelector) {
        clone.querySelector(`#${PANEL_ID}`)?.remove();
        clone.querySelector(`#${INDICATOR_ID}`)?.remove();
      }

      return [safeString(clone?.innerText || ""), safeString(clone?.textContent || "")]
        .filter(Boolean)
        .join("\n");
    }

    return [safeString(scopeRoot.innerText || ""), safeString(scopeRoot.textContent || "")]
      .filter(Boolean)
      .join("\n");
  }

  function extractVisibleAttendeeDetails(root) {
    // High-fidelity extraction for Luma UI patterns (e.g. One-Click RSVP)
    if (root?.querySelector) {
      const emailNode = root.querySelector(".email");
      if (emailNode) {
        const email = normalizeWhitespace(emailNode.textContent).toLowerCase();
        if (EMAIL_PATTERN.test(email)) {
          const nameNode = root.querySelector(".fw-medium") || emailNode.previousElementSibling;
          const nameText = normalizeWhitespace(nameNode?.textContent || "");
          const nameParts = splitName(nameText || deriveNameFromEmail(email));

          return {
            email,
            firstName: nameParts.firstName || deriveNameFromEmail(email),
            lastName: nameParts.lastName,
            name: nameParts.name || deriveNameFromEmail(email),
            phoneNumber: "",
            registeredAt: new Date().toISOString(),
          };
        }
      }
    }

    const lines = collectTextLines(root);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (lineLooksLikeBridgeStatus(line)) {
        continue;
      }

      const emailMatch = line.match(EMAIL_PATTERN);
      if (!emailMatch) {
        continue;
      }

      const email = emailMatch[0].toLowerCase();
      let nameCandidate = normalizeWhitespace(
        line
          .replace(emailMatch[0], "")
          .replace(/^welcome,?\s*/i, "")
          .replace(/\bto join the event.*$/i, "")
          .replace(/\bplease register below.*$/i, "")
          .replace(/^[^a-z0-9]+/i, ""),
      );

      if (!nameCandidate && index > 0) {
        const previousLine = lines[index - 1];
        if (
          previousLine &&
          !lineLooksLikeBridgeStatus(previousLine) &&
          !EMAIL_PATTERN.test(previousLine) &&
          !/\b(registration|welcome|one-click|rsvp|register below)\b/i.test(previousLine)
        ) {
          nameCandidate = previousLine.replace(/^welcome,?\s*/i, "").trim();
        }
      }

      const resolvedName = nameCandidate || deriveNameFromEmail(email);
      const nameParts = splitName(resolvedName);

      return {
        email,
        firstName: nameParts.firstName || deriveNameFromEmail(email),
        lastName: nameParts.lastName,
        name: nameParts.name || deriveNameFromEmail(email),
        phoneNumber: "",
        registeredAt: new Date().toISOString(),
      };
    }

    return null;
  }

  function getDraftAttendeeSnapshot() {
    if (!draftAttendee.email) {
      return null;
    }

    const email = safeString(draftAttendee.email).toLowerCase();
    const fallbackName =
      normalizeWhitespace(draftAttendee.name) ||
      [draftAttendee.firstName, draftAttendee.lastName].filter(Boolean).join(" ").trim() ||
      deriveNameFromEmail(email);
    const nameParts = splitName(fallbackName);

    return {
      email,
      firstName: safeString(draftAttendee.firstName) || nameParts.firstName || deriveNameFromEmail(email),
      lastName: safeString(draftAttendee.lastName) || nameParts.lastName,
      name: safeString(draftAttendee.name) || nameParts.name || deriveNameFromEmail(email),
      phoneNumber: safeString(draftAttendee.phoneNumber),
      registeredAt: new Date().toISOString(),
    };
  }

  function preloadVisibleAttendee(root = document, announce = true) {
    const attendee = extractVisibleAttendeeDetails(root);
    if (!applyDraftAttendee(attendee)) {
      return false;
    }

    if (announce) {
      setIndicatorStatus(
        "info",
        `Email captured: ${draftAttendee.email}`,
        `Badge Pop found ${draftAttendee.email} on page 1. It will wait for RSVP to finish and the You're In page to appear before sending the QR email.`,
      );
    }

    return true;
  }

  function rootLooksLikeCancellation(root) {
    return CANCELLATION_PATTERN.test(getNodeText(root).toLowerCase());
  }

  function rootLooksLikeRegistration(root) {
    const rootText = getNodeText(root).toLowerCase();
    if (!rootText || rootLooksLikeCancellation(root)) {
      return false;
    }

    return (
      REGISTRATION_CTA_PATTERN.test(rootText) ||
      /\bregistration\b/i.test(rootText) ||
      /\bregister below\b/i.test(rootText) ||
      /\bjoin the event\b/i.test(rootText) ||
      /\bone-click rsvp\b/i.test(rootText) ||
      /\bwelcome\b/i.test(rootText)
    );
  }

  function isRegistrationAction(clickable) {
    const label = getClickableLabel(clickable);
    if (!label) {
      return false;
    }

    if (CANCELLATION_PATTERN.test(label.toLowerCase())) {
      return false;
    }

    if (REGISTRATION_CTA_PATTERN.test(label)) {
      return true;
    }

    if (!MAYBE_REGISTRATION_CTA_PATTERN.test(label)) {
      return false;
    }

    const captureRoot = findCaptureRoot(clickable);
    return rootLooksLikeRegistration(captureRoot);
  }

  function findRsvpButton(root = document) {
    const clickables = Array.from(root.querySelectorAll('button, input[type="submit"], [role="button"]'));

    return clickables.find((clickable) => isRegistrationAction(clickable)) || null;
  }

  function findRegistrationCard(root = document) {
    const rsvpButton = findRsvpButton(root);
    if (rsvpButton) {
      return findCaptureRoot(rsvpButton);
    }

    return document.querySelector("main") || document.body;
  }

  function findInputAcrossRoots(roots, predicate) {
    for (const root of roots) {
      const match = queryFirstInput(root, predicate);
      if (match) {
        return match;
      }
    }

    return null;
  }

  function collectAttendeeDetails(root) {
    const searchRoots = [root, document].filter((candidate, index, collection) => candidate && collection.indexOf(candidate) === index);

    const emailInput = findInputAcrossRoots(
      searchRoots,
      (input) => input.type === "email" || describeField(input).includes("email"),
    );
    const firstNameInput = findInputAcrossRoots(
      searchRoots,
      (input) =>
        input.autocomplete === "given-name" ||
        /\bfirst\b/.test(describeField(input)),
    );
    const lastNameInput = findInputAcrossRoots(
      searchRoots,
      (input) =>
        input.autocomplete === "family-name" ||
        /\blast\b/.test(describeField(input)),
    );
    const fullNameInput = findInputAcrossRoots(
      searchRoots,
      (input) =>
        input.autocomplete === "name" ||
        /\bfull name\b/.test(describeField(input)) ||
        (/\bname\b/.test(describeField(input)) &&
          !/\b(first|last|email|ticket)\b/.test(describeField(input))),
    );
    const phoneInput = findInputAcrossRoots(
      searchRoots,
      (input) => input.autocomplete === "tel" || /\b(phone|mobile)\b/.test(describeField(input)),
    );

    const email = getInputValue(emailInput).toLowerCase() || draftAttendee.email;
    const firstName = getInputValue(firstNameInput) || draftAttendee.firstName;
    const lastName = getInputValue(lastNameInput) || draftAttendee.lastName;
    const fullName = getInputValue(fullNameInput) || draftAttendee.name;
    const name = fullName || [firstName, lastName].filter(Boolean).join(" ").trim() || deriveNameFromEmail(email);
    const phoneNumber = getInputValue(phoneInput) || draftAttendee.phoneNumber;
    const textAttendee = extractVisibleAttendeeDetails(root);

    if (!email && textAttendee) {
      return textAttendee;
    }

    if (!email) {
      return null;
    }

    const [derivedFirstName, ...remainingName] = name.split(/\s+/);

    return {
      email,
      firstName: firstName || derivedFirstName || name,
      lastName: lastName || remainingName.join(" ").trim(),
      name,
      phoneNumber,
      registeredAt: new Date().toISOString(),
    };
  }

  function findCaptureRoot(node) {
    if (!node?.closest) {
      return document;
    }

    const strongRoot =
      node.closest("form") ||
      node.closest('[role="dialog"]') ||
      node.closest('[aria-modal="true"]') ||
      node.closest("main") ||
      node.closest("section") ||
      node.closest("article");

    if (strongRoot) {
      return strongRoot;
    }

    let current = node;
    while (current && current !== document.body) {
      if (listInputs(current).length > 0) {
        return current;
      }

      current = current.parentElement;
    }

    return document;
  }

  function getEventTitle() {
    const heading =
      document.querySelector("main h1") ||
      document.querySelector("h1") ||
      document.querySelector('meta[property="og:title"]');
    const headingText =
      heading?.textContent?.trim() || heading?.getAttribute?.("content")?.trim() || "";

    if (headingText) {
      return headingText;
    }

    return document.title.replace(/\s*[\-|•|·].*$/, "").trim() || "Luma Event";
  }

  function getEventSlug() {
    const candidateUrls = [
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
      window.location.href,
    ].filter(Boolean);

    for (const candidateUrl of candidateUrls) {
      try {
        const parsed = new URL(candidateUrl, window.location.href);
        const segments = parsed.pathname
          .split("/")
          .filter(Boolean)
          .filter((segment) => !GENERIC_PAGE_SEGMENTS.has(segment.toLowerCase()));

        if (segments[0]) {
          return segments[0];
        }
      } catch (error) {
        continue;
      }
    }

    return "";
  }

  function getEventContext() {
    const eventName = getEventTitle();
    const eventSlug = getEventSlug();
    if (!eventSlug || GENERIC_PAGE_SEGMENTS.has(eventSlug.toLowerCase())) {
      return null;
    }

    const eventId = `luma-${slugify(eventSlug || eventName) || hashString(window.location.pathname)}`;

    return {
      eventId,
      eventName,
      sourceUrl: window.location.href,
    };
  }

  function createRegistrationKey(pendingRegistration) {
    return [
      safeString(pendingRegistration?.eventContext?.eventId),
      safeString(pendingRegistration?.attendee?.email).toLowerCase(),
    ].join(":");
  }

  function createRegistrationSignature(pendingRegistration) {
    return createRegistrationKey(pendingRegistration);
  }

  function getPageSentSignature() {
    return currentPageSentSignature;
  }

  function setPageSentSignature(signature) {
    currentPageSentSignature = safeString(signature);
    return true;
  }

  async function getPendingRegistration() {
    const stored = await storageGet([PENDING_KEY]);
    const pendingRegistration = stored[PENDING_KEY] || null;

    if (!pendingRegistration) {
      pendingRegistrationKnown = false;
      return null;
    }

    if (Date.now() - Number(pendingRegistration.capturedAt || 0) > PENDING_TTL_MS) {
      await clearPendingRegistration();
      return null;
    }

    pendingRegistrationKnown = true;
    return pendingRegistration;
  }

  async function savePendingRegistration(pendingRegistration) {
    pendingRegistrationKnown = true;
    await storageSet({
      [PENDING_KEY]: pendingRegistration,
    });
  }

  async function clearPendingRegistration() {
    pendingRegistrationKnown = false;
    await storageRemove([PENDING_KEY]);
  }

  async function ensurePendingRegistrationFromDraft() {
    const attendee = getDraftAttendeeSnapshot();
    if (!attendee) {
      return null;
    }

    const eventContext = getEventContext();
    if (!eventContext) {
      return null;
    }

    const pendingRegistration = {
      attendee,
      eventContext,
      capturedAt: Date.now(),
    };

    await savePendingRegistration(pendingRegistration);
    return pendingRegistration;
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      return panel;
    }

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "badgepop-panel hidden";
    panel.innerHTML = `
      <div class="badgepop-panel-header">
        <span class="badgepop-panel-dot"></span>
        <span class="badgepop-panel-title">Badge Pop Bridge</span>
      </div>
      <p id="${PANEL_MESSAGE_ID}" class="badgepop-panel-message"></p>
      <button id="${PANEL_ACTION_ID}" class="badgepop-panel-action" hidden type="button"></button>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  function ensureIndicator() {
    let indicator = document.getElementById(INDICATOR_ID);
    if (indicator) {
      return indicator;
    }

    indicator = document.createElement("div");
    indicator.id = INDICATOR_ID;
    indicator.className = "badgepop-indicator ready";
    indicator.innerHTML = `
      <span class="badgepop-indicator-dot"></span>
      <span id="${INDICATOR_LABEL_ID}" class="badgepop-indicator-label">Badge Pop active</span>
    `;

    document.body.appendChild(indicator);
    return indicator;
  }

  function setIndicatorStatus(kind, label, detail = "") {
    const indicator = ensureIndicator();
    const labelNode = indicator.querySelector(`#${INDICATOR_LABEL_ID}`);

    indicator.className = `badgepop-indicator ${kind}`;
    indicator.title = detail || label;
    labelNode.textContent = label;
  }

  function setPanelStatus(kind, message, actionLabel = null, actionHandler = null, indicatorLabel = null) {
    const panel = ensurePanel();
    const messageNode = panel.querySelector(`#${PANEL_MESSAGE_ID}`);
    const actionNode = panel.querySelector(`#${PANEL_ACTION_ID}`);

    panel.className = `badgepop-panel ${kind}`;
    messageNode.textContent = message;
    setIndicatorStatus(kind, indicatorLabel || "Badge Pop active", message);

    if (actionLabel && actionHandler) {
      actionNode.hidden = false;
      actionNode.textContent = actionLabel;
      actionNode.onclick = actionHandler;
    } else {
      actionNode.hidden = true;
      actionNode.textContent = "";
      actionNode.onclick = null;
    }
  }

  function handleAsyncError(error) {
    if (isContextInvalidatedError(error)) {
      return;
    }

    setIndicatorStatus("error", "Bridge error", safeString(error && error.message ? error.message : error));
    console.error("Badge Pop Bridge error", error);
  }

  function runBridgeCheck() {
    maybeBridgePendingRegistration().catch(handleAsyncError);
  }

  function containsConfirmationText(text) {
    const normalizedText = safeString(text)
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, " ");
    if (!normalizedText) {
      return false;
    }

    if (SUCCESS_PHRASES.some((phrase) => normalizedText.includes(phrase))) {
      return true;
    }

    return (
      (normalizedText.includes("add to calendar") &&
        normalizedText.includes("invite a friend") &&
        normalizedText.includes("profile complete")) ||
      normalizedText.includes("manage registration") &&
      (normalizedText.includes("add to calendar") || normalizedText.includes("view ticket"))
    );
  }

  function countMatchingPhrases(text, phrases) {
    const normalizedText = safeString(text).toLowerCase();
    if (!normalizedText) {
      return 0;
    }

    return phrases.filter((phrase) => normalizedText.includes(phrase)).length;
  }

  function scheduleObserverWork(root = null) {
    if (observerTimer != null) {
      return;
    }

    observerTimer = window.setTimeout(() => {
      observerTimer = null;
      const targetRoot = root || findRegistrationCard(document);
      refreshVisibleAttendeeState(targetRoot);
      if (registrationLooksConfirmed() && (pendingRegistrationKnown || draftAttendee.email)) {
        runBridgeCheck();
      }
    }, OBSERVER_THROTTLE_MS);
  }

  function registrationLooksConfirmed() {
    const pageText = getDocumentTextWithoutBridgeUi();
    if (containsConfirmationText(pageText)) {
      return true;
    }

    const postRegistrationCueCount = countMatchingPhrases(pageText, POST_REGISTRATION_PHRASES);
    const visibleRsvpButton = findRsvpButton(document);

    return postRegistrationCueCount >= 2 && !visibleRsvpButton;
  }

  async function sendRegistrationToBackend(pendingRegistration) {
    const registrationSignature = createRegistrationSignature(pendingRegistration);

    if (
      bridgeInFlight ||
      getPageSentSignature() === registrationSignature
    ) {
      await clearPendingRegistration();
      return;
    }

    bridgeInFlight = true;
    setPanelStatus(
      "info",
      `You're In page detected for ${pendingRegistration.attendee.email}. Sending the check-in QR email now...`,
      null,
      null,
      "Sending QR email",
    );

    try {
      const response = await fetch(`${BACKEND_ORIGIN}/api/integrations/luma/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pendingRegistration),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Registration bridge failed.");
      }

      setPageSentSignature(registrationSignature);
      await clearPendingRegistration();
      clearDraftAttendee();

      setPanelStatus(
        "success",
        payload.emailSent
          ? `Check-in QR email sent to ${pendingRegistration.attendee.email}. After they scan that QR at the event, they can sign in and claim their token.`
          : `This registration was already linked earlier. The guest can use their existing QR email to check in and claim the token later.`,
        null,
        null,
        payload.emailSent ? "QR email sent" : "Already linked",
      );
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        return;
      }

      setPanelStatus(
        "error",
        error.message || "Could not send the check-in email through the backend.",
        "Retry",
        () => {
          sendRegistrationToBackend(pendingRegistration);
        },
        "Bridge error",
      );
    } finally {
      bridgeInFlight = false;
    }
  }

  async function maybeBridgePendingRegistration() {
    if (bridgeInFlight) {
      return;
    }

    const confirmed = registrationLooksConfirmed();
    if (!confirmed) {
      return;
    }

    let pendingRegistration = await getPendingRegistration();
    if (!pendingRegistration) {
      pendingRegistration = await ensurePendingRegistrationFromDraft();
    }

    if (!pendingRegistration) {
      return;
    }

    await sendRegistrationToBackend(pendingRegistration);
  }

  function capturePendingRegistration(root) {
    const attendee = collectAttendeeDetails(root);
    if (!attendee) {
      setIndicatorStatus(
        "info",
        "Waiting for guest details",
        "Badge Pop could not find an attendee email yet. Finish the RSVP fields, then try again.",
      );
      return;
    }

    const eventContext = getEventContext();
    if (!eventContext) {
      setIndicatorStatus(
        "info",
        "Waiting for event page",
        "Badge Pop can only attach a guest to a real Luma event page, not a generic Luma landing page.",
      );
      return;
    }

    const signature = `${eventContext.eventId}:${attendee.email}`;
    const now = Date.now();

    if (lastCaptureSignature === signature && now - lastCaptureAt < CAPTURE_COOLDOWN_MS) {
      return;
    }

    lastCaptureSignature = signature;
    lastCaptureAt = now;
    setPageSentSignature("");

    const pendingRegistration = {
      attendee,
      eventContext,
      capturedAt: now,
    };

    savePendingRegistration(pendingRegistration).catch(() => {});
    setPanelStatus(
      "info",
      `RSVP captured for ${attendee.email}. I already fetched this email from page 1. Once page 2 shows You're In, the QR email will be sent automatically.`,
      null,
      null,
      "RSVP captured",
    );
  }

  function handleFormSubmit(event) {
    const form = event.target.closest("form");
    if (form && rootLooksLikeRegistration(form)) {
      capturePendingRegistration(form);
    }
  }

  function handleRegisterClick(event) {
    const clickable = event.target.closest('button, input[type="submit"], [role="button"]');
    if (!clickable) {
      return;
    }

    if (!isRegistrationAction(clickable)) {
      return;
    }

    const captureRoot = findCaptureRoot(clickable);
    preloadVisibleAttendee(captureRoot, false);
    capturePendingRegistration(captureRoot);

    window.setTimeout(() => scheduleObserverWork(), 500);
    window.setTimeout(() => scheduleObserverWork(), 1500);
    window.setTimeout(() => scheduleObserverWork(), 3000);
  }

  function handleFieldInput(event) {
    const input = event.target.closest("input, textarea");
    if (!input) {
      return;
    }

    updateDraftAttendeeFromInput(input);

    if (draftAttendee.email) {
      setIndicatorStatus(
        "info",
        "Guest details captured",
        `Badge Pop is tracking RSVP details for ${draftAttendee.email}.`,
      );
    }
  }

  function refreshVisibleAttendeeState(root = null) {
    const targetRoot = root || findRegistrationCard(document);
    if (draftAttendee.email && registrationLooksConfirmed() && !bridgeInFlight) {
      setIndicatorStatus(
        "info",
        `You're In detected: ${draftAttendee.email}`,
        `Badge Pop detected the confirmation page for ${draftAttendee.email} and is sending the QR email.`,
      );
      runBridgeCheck();
      return;
    }

    const shouldAnnounce = !pendingRegistrationKnown && !bridgeInFlight;
    if (preloadVisibleAttendee(targetRoot, shouldAnnounce)) {
      return;
    }

    if (!draftAttendee.email) {
      setIndicatorStatus(
        "ready",
        "Badge Pop active",
        "Badge Pop Bridge is active and waiting to detect guest details on this Luma page.",
      );
    }
  }

  function startObservers() {
    refreshVisibleAttendeeState();
    document.addEventListener("submit", handleFormSubmit, true);
    document.addEventListener("click", handleRegisterClick, true);
    document.addEventListener("input", handleFieldInput, true);
    document.addEventListener("change", handleFieldInput, true);

    const observer = new MutationObserver((mutations) => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        scheduleObserverWork();
        return;
      }

      if (pendingRegistrationKnown) {
        scheduleObserverWork();
        return;
      }

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          if (nodeIsBridgeUi(node)) {
            continue;
          }

          const nodeText = normalizeWhitespace(node.innerText || node.textContent || "");
          if (
            EMAIL_PATTERN.test(nodeText) ||
            REGISTRATION_CTA_PATTERN.test(nodeText) ||
            /\bwelcome\b/i.test(nodeText) ||
            containsConfirmationText(nodeText) ||
            registrationLooksConfirmed()
          ) {
            scheduleObserverWork();
            return;
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
      }

      scheduleObserverWork();
    }, IDLE_SCAN_INTERVAL_MS);
  }

  refreshVisibleAttendeeState();
  runBridgeCheck();
  startObservers();
})();
