import {
  BadgeIcon,
  DetailRow,
  EmptyState,
  Field,
  MetaCard,
  NoticeBanner,
  PageHeader,
  SectionHeader,
  ShieldIcon,
  Sidebar,
  StatusBadge,
  Topbar,
  apiRequest,
  createRoot,
  cx,
  formatDate,
  html,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellCardClass,
  useEffect,
  useState,
} from "./saas-ui.js";

function getTokenFromPath() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[0] === "verify" ? segments[1] || "" : "";
}

function PanelCard({
  eyebrow = null,
  title,
  description,
  actions = null,
  className = "",
  bodyClassName = "px-5 py-5",
  children,
}) {
  return html`
    <section className=${cx(shellCardClass, className)}>
      <${SectionHeader}
        eyebrow=${eyebrow}
        title=${title}
        description=${description}
        actions=${actions}
      />
      <div className=${bodyClassName}>${children}</div>
    </section>
  `;
}

function LoadingPanel({ label }) {
  return html`
    <div className=${cx(shellCardClass, "p-10")}>
      <div className="flex items-center gap-3 text-sm font-medium text-navy-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500"></span>
        ${label}
      </div>
    </div>
  `;
}

function VerificationRecord({ payload, loading }) {
  if (loading) {
    return html`<${LoadingPanel} label="Verifying badge on-chain..." />`;
  }

  if (!payload?.badge) {
    return html`
      <${PanelCard}
        eyebrow="Record"
        title="On-chain record"
        description="The badge owner and event identifier returned by the contract."
      >
        <${EmptyState}
          compact=${true}
          icon=${html`<${BadgeIcon} className="h-6 w-6" />`}
          title="No badge loaded yet."
          description="Enter a token ID or open a shared verification link to load the badge record."
        />
      </${PanelCard}>
    `;
  }

  const badge = payload.badge;
  const issuedTo = badge.attendeeName
    ? `${badge.attendeeName}${badge.attendeeEmail ? ` (${badge.attendeeEmail})` : ""}`
    : badge.attendeeEmail || "Unknown attendee";

  return html`
    <${PanelCard}
      eyebrow="Record"
      title="On-chain record"
      description="The badge owner and event identifier returned by the contract."
    >
      <div className="divide-y divide-border">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Token</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-navy-900">#${badge.tokenId}</p>
          </div>
          <${StatusBadge} tone="success">Verified</${StatusBadge}>
        </div>
        <${DetailRow} label="Owner wallet" value=${badge.owner || "Unavailable"} mono=${true} />
        <${DetailRow} label="On-chain event ID" value=${badge.eventId || "Unavailable"} mono=${true} />
        <${DetailRow} label="Event name" value=${payload.event?.name || "Unavailable"} />
        <${DetailRow} label="Issued to" value=${issuedTo} />
        <${DetailRow} label="Claimed at" value=${formatDate(badge.claimedAt)} />
        <${DetailRow} label="Transaction" value=${badge.txHash || "Unavailable"} mono=${true} />
        <${DetailRow} label="Contract" value=${badge.contractAddress || "Unavailable"} mono=${true} />
      </div>
    </${PanelCard}>
  `;
}

function VerifyApp() {
  const initialToken = getTokenFromPath();
  const [dashboard, setDashboard] = useState(null);
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [verification, setVerification] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  function setBanner(message, tone = "info") {
    setNotice(message ? { message, tone } : null);
  }

  async function loadDashboardData() {
    const payload = await apiRequest("/api/dashboard", { auth: false });
    setDashboard(payload);
    return payload;
  }

  async function verifyToken(tokenId) {
    const normalizedToken = String(tokenId || "").trim();
    if (!normalizedToken || Number.isNaN(Number(normalizedToken))) {
      setVerification(null);
      setBanner("Enter a token ID to verify a badge on-chain.", "info");
      return null;
    }

    setVerifyLoading(true);
    setBanner("Verifying badge against the blockchain...", "info");

    try {
      const payload = await apiRequest(`/api/badges/${encodeURIComponent(normalizedToken)}/verify`, {
        auth: false,
      });
      setVerification(payload);
      setBanner("Badge verified successfully on-chain.", "success");
      return payload;
    } catch (error) {
      setVerification(null);
      setBanner(error.message, "error");
      return null;
    } finally {
      setVerifyLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadDashboardData();
        if (!active) {
          return;
        }

        if (initialToken) {
          await verifyToken(initialToken);
        } else {
          setBanner("Enter a token ID to verify a badge on-chain.", "info");
        }
      } catch (error) {
        if (active) {
          setBanner(error.message || "Could not load the verification page.", "error");
        }
      } finally {
        if (active) {
          setPageLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const nextToken = String(tokenInput || "").trim();
    if (!nextToken) {
      setBanner("Enter a token ID.", "warn");
      setVerification(null);
      return;
    }

    window.location.href = `/verify/${encodeURIComponent(nextToken)}`;
  }

  if (pageLoading && !dashboard) {
    return html`
      <div className="min-h-screen bg-shell">
        <${Sidebar} active="dashboard" />
        <div className="min-h-screen lg:pl-72">
          <${Topbar}
            searchValue=${searchValue}
            onSearchChange=${setSearchValue}
            searchPlaceholder="Search token..."
          />
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <${LoadingPanel} label="Loading verification page..." />
          </main>
        </div>
      </div>
    `;
  }

  return html`
    <div className="min-h-screen bg-shell">
      <${Sidebar} active="dashboard" />

      <div className="min-h-screen lg:pl-72">
        <${Topbar}
          searchValue=${searchValue}
          onSearchChange=${setSearchValue}
          searchPlaceholder="Search token..."
        />

        <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <${PageHeader}
            eyebrow="Public Verification"
            title="Verify badge"
            description="Check the owner, event identifier, and transaction details for a minted attendance badge."
            actions=${html`<a href="/" className=${secondaryButtonClass}>Back to dashboard</a>`}
            meta=${[
              html`<${MetaCard} label="Event ID" value=${dashboard?.event?.id || "Unavailable"} mono=${true} />`,
              html`<${MetaCard}
                label="Blockchain Claims"
                value=${dashboard?.platform?.chainConfigured ? "Enabled" : "Waiting for config"}
              />`,
            ]}
          />

          ${notice ? html`<div className="mt-6"><${NoticeBanner} message=${notice.message} tone=${notice.tone} /></div>` : null}

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
            <${PanelCard}
              eyebrow="Lookup"
              title="Token lookup"
              description="Enter a token ID to open a shareable public verification view."
            >
              <form className="space-y-4" onSubmit=${handleSubmit}>
                <${Field} label="Token ID" htmlFor="verifyTokenId">
                  <input
                    id="verifyTokenId"
                    type="text"
                    inputMode="numeric"
                    placeholder="1"
                    className=${inputClass}
                    value=${tokenInput}
                    onInput=${(event) => {
                      const value = event.currentTarget.value;
                      setTokenInput(value);
                    }}
                  />
                </${Field}>
                <button type="submit" className=${cx(primaryButtonClass, "w-full")}>
                  Verify badge
                </button>
              </form>
            </${PanelCard}>

            <${VerificationRecord} payload=${verification} loading=${verifyLoading} />
          </section>

          <section className="mt-6">
            <${PanelCard}
              eyebrow="Status"
              title="Verification source"
              description="The public record is resolved through the configured contract and enriched with local claim metadata when available."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Lookup</p>
                  <p className="mt-3 text-sm font-medium text-navy-900">
                    ${verification?.badge ? `Token #${verification.badge.tokenId}` : "Waiting for token"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Chain</p>
                  <div className="mt-3">
                    <${StatusBadge} tone=${dashboard?.platform?.chainConfigured ? "success" : "neutral"}>
                      ${dashboard?.platform?.chainConfigured ? "Configured" : "Not configured"}
                    </${StatusBadge}>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Result</p>
                  <div className="mt-3">
                    <${StatusBadge} tone=${verification?.badge ? "success" : "neutral"}>
                      ${verification?.badge ? "Verified" : "Pending"}
                    </${StatusBadge}>
                  </div>
                </div>
              </div>
            </${PanelCard}>
          </section>
        </main>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${VerifyApp} />`);
