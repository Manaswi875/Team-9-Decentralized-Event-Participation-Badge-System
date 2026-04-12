(function () {

  let hooked = false;

  // ─── Event context ──────────────────────────────────────────────────────────

  function getEventId() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const slug = segments[segments.length - 1] || 'unknown';
    return 'LUMA-' + slug.toUpperCase();
  }

  function getEventName() {
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return (document.title || 'Unknown Event')
      .replace(/\s*[·\-–—|]\s*(Luma|lu\.ma).*$/i, '')
      .trim();
  }

  // ─── Register button detection (multi-signal) ───────────────────────────────

  // Signal 1 — aria-label or data attributes contain registration intent.
  // These are set by developers and don't change with copy/localisation updates.
  function matchesByAttribute(el) {
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const dataAction = (el.getAttribute('data-action') || '').toLowerCase();
    const dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();
    const combined = `${ariaLabel} ${dataAction} ${dataTestId}`;

    const attrKeywords = ['register', 'rsvp', 'ticket', 'attend', 'join', 'apply', 'book'];
    return attrKeywords.some(kw => combined.includes(kw));
  }

  // Signal 2 — CSS class names suggest a registration or primary CTA button.
  // Class names are set by engineers and are more stable than marketing copy.
  function matchesByClassName(el) {
    const cls = (el.className || '').toLowerCase();
    const classKeywords = ['register', 'rsvp', 'ticket', 'attend', 'join', 'primary', 'cta'];
    return classKeywords.some(kw => cls.includes(kw));
  }

  // Signal 3 — Visible text contains a registration-related keyword.
  // Kept as a signal (not the only signal) and expanded to cover more copy variants.
  function matchesByText(el) {
    const text = (el.textContent || '').toLowerCase().trim();

    // Reject buttons whose text is clearly navigation or utility
    const NOISE = ['sign in', 'log in', 'sign up', 'create', 'share', 'copy', 'close', 'cancel', 'back', 'next', 'more'];
    if (NOISE.some(n => text === n)) return false;

    const textKeywords = [
      'register', 'rsvp', 'request to join', 'get ticket', 'get tickets',
      'attend', 'approve', 'join event', 'join now', 'apply', 'apply now',
      'book', 'book now', 'claim spot', 'claim your spot', 'reserve',
      'reserve spot', 'reserve seat', 'sign up for event', 'i\'m in',
    ];
    return textKeywords.some(kw => text.includes(kw));
  }

  // Signal 4 — The button is visually prominent (primary CTA styling).
  // The Register button is almost always the most visually prominent button
  // on an event page — filled background, not a ghost/outline/text button.
  function matchesByStyle(el) {
    try {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;

      // Parse out the RGB values
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return false;

      const [, r, g, b] = match.map(Number);

      // Reject transparent or near-white backgrounds (ghost/outline buttons)
      const isTransparent = style.backgroundColor === 'transparent' || style.opacity === '0';
      const isWhiteOrLight = r > 240 && g > 240 && b > 240;
      if (isTransparent || isWhiteOrLight) return false;

      // A non-transparent, non-white background = likely a filled primary button
      return true;
    } catch (_) {
      return false;
    }
  }

  // Signal 5 — The button lives in the event hero / details section,
  // not in the page nav, footer, or a sidebar.
  // We check that none of its ancestors are <nav>, <footer>, or a header bar.
  function matchesByPosition(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      const role = (node.getAttribute('role') || '').toLowerCase();
      const cls = (node.className || '').toLowerCase();

      if (tag === 'nav' || tag === 'footer') return false;
      if (role === 'navigation' || role === 'banner') return false;
      if (cls.includes('navbar') || cls.includes('topbar') || cls.includes('footer')) return false;

      node = node.parentElement;
    }
    return true;
  }

  // ─── Final scorer ────────────────────────────────────────────────────────────
  // Each signal contributes a score. We pick the highest-scoring button.
  // This way we don't silently fail if one signal misses — we still pick the
  // best candidate from whatever signals DO fire.

  function scoreButton(el) {
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (tag !== 'button' && role !== 'button') return 0;

    // Must be visible
    if (el.offsetParent === null) return 0;

    let score = 0;
    if (matchesByAttribute(el))  score += 4; // strongest signal — set by devs
    if (matchesByClassName(el))  score += 3; // strong — class names are stable
    if (matchesByText(el))       score += 2; // medium — copy can change
    if (matchesByPosition(el))   score += 2; // medium — structural check
    if (matchesByStyle(el))      score += 1; // weak — styling can vary

    return score;
  }

  function findRegisterButton() {
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));

    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      const score = scoreButton(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    // Require a minimum score of 2 — must match at least one meaningful signal.
    // A score of 1 (style-only) is too ambiguous to act on.
    return bestScore >= 2 ? best : null;
  }

  // ─── Minting flow ───────────────────────────────────────────────────────────

  async function mintBadge() {
    const eventContext = {
      eventId: getEventId(),
      eventName: getEventName(),
    };

    console.log('[Badge Bridge] Registration detected — minting badge for:', eventContext);

    try {
      const response = await fetch('http://localhost:3000/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventContext }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccessUI(data.dummyAddress, data.transactionHash, eventContext.eventName);
      } else {
        console.error('[Badge Bridge] Minting failed:', data.error);
      }
    } catch (err) {
      console.error('[Badge Bridge] Could not reach backend:', err);
    }
  }

  // ─── Hook the Register button ───────────────────────────────────────────────

  function hookRegisterButton(btn) {
    if (hooked) return;
    hooked = true;

    console.log('[Badge Bridge] Hooked button:', btn.textContent.trim(), '| score:', scoreButton(btn));

    btn.addEventListener('click', () => {
      setTimeout(mintBadge, 200);
    }, { capture: true, once: true });
  }

  // ─── MutationObserver ───────────────────────────────────────────────────────

  function startObserver() {
    const observer = new MutationObserver(() => {
      if (hooked) { observer.disconnect(); return; }
      const btn = findRegisterButton();
      if (btn) { hookRegisterButton(btn); observer.disconnect(); }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Immediate check in case the button already exists
    const btn = findRegisterButton();
    if (btn) { hookRegisterButton(btn); observer.disconnect(); }

    setTimeout(() => observer.disconnect(), 30_000);
  }

  // ─── Success modal ──────────────────────────────────────────────────────────

  function showSuccessUI(dummyAddress, txHash, eventName) {
    const existing = document.getElementById('web3-success-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'web3-success-modal';
    modal.className = 'web3-modal-overlay';

    modal.innerHTML = `
      <div class="web3-modal-content">
        <div class="web3-modal-header">
          <h2>🎉 Registration Verified!</h2>
        </div>
        <div class="web3-modal-body">
          <p>You have successfully registered for <strong>${eventName}</strong>.</p>
          <p class="web3-highlight">Your Participation Badge has been permanently stored on the Base blockchain.</p>
          <div class="web3-tx-info">
            <p><strong>Sent To (Dummy Account):</strong> <br/> <code>${dummyAddress}</code></p>
            <p><strong>Transaction Hash:</strong> <br/> <code>${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}</code></p>
          </div>
        </div>
        <button id="web3-modal-close" class="web3-close-btn">Awesome!</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('web3-modal-close').addEventListener('click', () => modal.remove());
  }

  // ─── Entry point ────────────────────────────────────────────────────────────

  const NON_EVENT_PREFIXES = [
    '/home', '/discover', '/calendar', '/explore', '/blog', '/about',
    '/pricing', '/signin', '/login', '/signup', '/settings', '/profile',
    '/notifications', '/dashboard', '/manage', '/create',
  ];

  function isEventURL() {
    const path = window.location.pathname;
    if (path === '/' || path === '') return false;
    return !NON_EVENT_PREFIXES.some(prefix => path.startsWith(prefix));
  }

  if (isEventURL()) {
    console.log('[Badge Bridge] Event URL detected — watching for Register button.');
    startObserver();
  } else {
    console.log('[Badge Bridge] Non-event URL — skipping.');
  }

})();
