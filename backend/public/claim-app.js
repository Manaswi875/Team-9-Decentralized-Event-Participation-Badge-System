import {
  EmptyState,
  Field,
  MailIcon,
  MetaCard,
  NoticeBanner,
  PageHeader,
  PortalIcon,
  SectionHeader,
  ShieldIcon,
  Sidebar,
  StatusBadge,
  Topbar,
  BadgeIcon,
  React,
  authStorageKey,
  apiRequest,
  createRoot,
  cx,
  formatDate,
  getClaimToken,
  html,
  inputClass,
  primaryButtonClass,
  replaceClaimPageUrl,
  secondaryButtonClass,
  shellCardClass,
  useDeferredValue,
  useEffect,
  useState,
} from "./saas-ui.js";

class ClaimErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Claim portal render error", error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return html`
      <div className="min-h-screen bg-shell">
        <${Sidebar} active="claim" />
        <div className="min-h-screen lg:pl-72">
          <${Topbar} searchPlaceholder="Search help..." />
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <${NoticeBanner}
              tone="error"
              message=${this.state.error?.message || "The claim portal hit a render error. Check the browser console for details."}
            />
          </main>
        </div>
      </div>
    `;
  }
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

function DetailRow({ label, value, mono = false }) {
  return html`
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-navy-500">${label}</span>
      <span
        className=${cx(
          "min-w-0 max-w-[60%] text-right text-sm font-medium text-navy-900",
          mono ? "break-all font-mono text-xs sm:text-sm" : "break-words",
        )}
      >
        ${value}
      </span>
    </div>
  `;
}

function ClaimStatusBadge({ status }) {
  const normalized = String(status || "").trim();
  const tone =
    normalized === "claimed"
      ? "accent"
      : normalized === "claimable"
        ? "success"
        : "neutral";
  const label =
    normalized === "claimed"
      ? "Claimed"
      : normalized === "claimable"
        ? "Ready to claim"
        : "Awaiting check-in";

  return html`<${StatusBadge} tone=${tone}>${label}</${StatusBadge}>`;
}

function ClaimContextCard({ token, context, loading }) {
  if (loading) {
    return html`
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-slate-50/70 px-4 py-6 text-sm font-medium text-navy-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500"></span>
        Loading claim context...
      </div>
    `;
  }

  if (!token) {
    return html`
      <${EmptyState}
        compact=${true}
        icon=${html`<${MailIcon} className="h-6 w-6" />`}
        title="Open this page from a claim email."
        description="The attendee tied to the claim link will appear here automatically as soon as a token is present in the URL."
      />
    `;
  }

  if (!context?.guest) {
    return html`
      <${EmptyState}
        compact=${true}
        icon=${html`<${PortalIcon} className="h-6 w-6" />`}
        title="Claim link unavailable."
        description="This invitation could not be loaded. Try reopening the latest claim email from the organizer flow."
      />
    `;
  }

  return html`
    <div className="divide-y divide-border">
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-navy-900">${context.guest.name}</p>
          <p className="mt-1 text-sm text-navy-500">${context.guest.email}</p>
        </div>
        <${ClaimStatusBadge} status=${context.status || context.guest.claimStatus} />
      </div>
      <${DetailRow} label="Checked in" value=${formatDate(context.guest.checkedInAt)} />
      <${DetailRow} label="Fallback code" value=${context.guest.checkInCode || "Unavailable"} mono=${true} />
      <${DetailRow}
        label="Claim status"
        value=${String(context.guest.claimStatus || "awaiting-check-in").replaceAll("-", " ")}
      />
      <${DetailRow} label="Verification" value=${context.guest.verifyUrl ? "Active" : "Not minted yet"} />
    </div>
  `;
}

function AccountCard({ account }) {
  if (!account) {
    return html`
      <${EmptyState}
        compact=${true}
        icon=${html`<${ShieldIcon} className="h-6 w-6" />`}
        title="No account connected."
        description="Create an account or sign in with the same email that received the claim invitation. A wallet address is created automatically."
      />
    `;
  }

  return html`
    <div className="divide-y divide-border">
      <${DetailRow} label="Email" value=${account.email} />
      <${DetailRow} label="Wallet" value=${account.walletAddress} mono=${true} />
      <${DetailRow} label="Created" value=${formatDate(account.createdAt)} />
      <div className="py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-navy-500">Eligible guest</span>
          ${account.eligibleGuest
            ? html`<${ClaimStatusBadge} status=${account.eligibleGuest.claimStatus} />`
            : html`<span className="text-sm font-medium text-navy-900">None</span>`}
        </div>
        <p className="mt-3 text-sm text-navy-700">
          ${account.eligibleGuest
            ? `${account.eligibleGuest.name} · ${account.eligibleGuest.email}`
            : "No RSVP is currently linked to this account email."}
        </p>
      </div>
    </div>
  `;
}

function BadgeGrid({ badges, query }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filteredBadges = badges.filter((badge) => {
    if (!normalizedQuery) {
      return true;
    }

    return [badge.tokenId, badge.eventName, badge.eventId, badge.contractAddress].some((value) =>
      String(value || "").toLowerCase().includes(normalizedQuery),
    );
  });

  if (!badges.length) {
    return html`
      <${EmptyState}
        compact=${true}
        icon=${html`<${BadgeIcon} className="h-6 w-6" />`}
        title="No badges minted yet."
        description="Once the claim is completed, minted badges will appear here with a direct verification link."
      />
    `;
  }

  if (!filteredBadges.length) {
    return html`
      <${EmptyState}
        compact=${true}
        icon=${html`<${BadgeIcon} className="h-6 w-6" />`}
        title="No badges match your search."
        description=${`Try a different search term instead of "${query}".`}
      />
    `;
  }

  return html`
    <div className="grid gap-4 lg:grid-cols-2">
      ${filteredBadges.map(
        (badge) => html`
          <article className="rounded-xl border border-border bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Soulbound badge</p>
                <p className="mt-2 text-lg font-semibold text-navy-900">Token #${badge.tokenId}</p>
              </div>
              <${StatusBadge} tone="accent">Minted</${StatusBadge}>
            </div>
            <div className="mt-4 space-y-3 text-sm text-navy-700">
              <p>${badge.eventName}</p>
              <p className="text-navy-500">Claimed ${formatDate(badge.claimedAt)}</p>
              <p className="break-all font-mono text-xs text-navy-500">${badge.contractAddress || "Contract unavailable"}</p>
            </div>
            <a
              href=${badge.verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Open verification
            </a>
          </article>
        `,
      )}
    </div>
  `;
}

function ClaimApp() {
  const [dashboard, setDashboard] = useState(null);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(Boolean(getClaimToken()));
  const [account, setAccount] = useState(null);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(authStorageKey) || "");
  const [notice, setNotice] = useState(null);
  const [busyState, setBusyState] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [refreshPassword, setRefreshPassword] = useState("");
  const [authView, setAuthView] = useState("login");
  const deferredSearch = useDeferredValue(searchValue);
  const claimToken = getClaimToken();
  const isAuthenticated = Boolean(account);

  function setBanner(message, tone = "info") {
    setNotice(message ? { message, tone } : null);
  }

  async function loadDashboardData() {
    const payload = await apiRequest("/api/dashboard", { auth: false });
    setDashboard(payload);
    return payload;
  }

  async function loadAccountData(nextToken = authToken) {
    if (!nextToken) {
      setAccount(null);
      return null;
    }

    try {
      const payload = await apiRequest("/api/auth/me", { authToken: nextToken });
      setAccount(payload.account || null);
      return payload.account || null;
    } catch (_error) {
      setAuthToken("");
      window.localStorage.removeItem(authStorageKey);
      setAccount(null);
      return null;
    }
  }

  async function loadClaimData(token = getClaimToken()) {
    if (!token) {
      setContext(null);
      setContextLoading(false);
      return null;
    }

    setContextLoading(true);
    try {
      const payload = await apiRequest(`/api/claims/context?token=${encodeURIComponent(token)}`, {
        auth: false,
      });
      setContext(payload);
      return payload;
    } finally {
      setContextLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const tasks = [loadDashboardData(), loadAccountData(authToken)];
        if (claimToken) {
          tasks.push(loadClaimData(claimToken));
        } else {
          setContextLoading(false);
        }

        await Promise.all(tasks);

        if (!active) {
          return;
        }

        if (!claimToken) {
          setBanner(
            "Sign in to inspect badges already tied to your wallet, or open this page from a claim email link to continue a specific claim.",
            "warn",
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setBanner(error.message || "Could not load the claim portal.", "error");
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

  useEffect(() => {
    const preferredEmail = account?.email || context?.guest?.email || "";
    if (!preferredEmail) {
      return;
    }

    setRegisterForm((current) => (current.email ? current : { ...current, email: preferredEmail }));
    setLoginForm((current) => (current.email ? current : { ...current, email: preferredEmail }));
    setForgotEmail((current) => current || preferredEmail);
  }, [account?.email, context?.guest?.email]);

  async function handleRegister(event) {
    event.preventDefault();
    setBusyState("register");
    setBanner("Creating account and wallet...", "info");

    try {
      const payload = await apiRequest("/api/auth/register", {
        method: "POST",
        body: registerForm,
        auth: false,
      });

      setAuthToken(payload.authToken);
      window.localStorage.setItem(authStorageKey, payload.authToken);
      setAccount(payload.account || null);
      setRegisterForm((current) => ({ ...current, password: "" }));
      setBanner("Account created. Your wallet is ready for claims.", "success");
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusyState("login");
    setBanner("Signing in...", "info");

    try {
      const payload = await apiRequest("/api/auth/login", {
        method: "POST",
        body: loginForm,
        auth: false,
      });

      setAuthToken(payload.authToken);
      window.localStorage.setItem(authStorageKey, payload.authToken);
      setAccount(payload.account || null);
      setLoginForm((current) => ({ ...current, password: "" }));
      setBanner("Signed in successfully.", "success");
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  async function handleForgotPassword(event) {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    setBusyState("forgot");
    setBanner("Removing stored account details for that email...", "info");

    try {
      const payload = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: forgotEmail },
        auth: false,
      });

      if (account?.email === String(forgotEmail || "").trim().toLowerCase()) {
        setAuthToken("");
        window.localStorage.removeItem(authStorageKey);
        setAccount(null);
      }

      setAuthView("login");
      setBanner(payload.message, "success");
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  async function handleRefreshClaim(event) {
    event.preventDefault();
    setBusyState("refresh");
    setBanner("Refreshing the claim flow for another test...", "info");

    try {
      const payload = await apiRequest("/api/claims/refresh", {
        method: "POST",
        body: {
          claimToken: getClaimToken(),
          currentPassword: refreshPassword,
        },
        authToken,
      });

      if (payload.account) {
        setAccount(payload.account);
      } else {
        await loadAccountData(authToken);
      }

      if (payload.claimUrl) {
        replaceClaimPageUrl(payload.claimUrl);
      }

      await loadClaimData(getClaimToken());
      setRefreshPassword("");

      const resetNote =
        payload.resetMode === "burned-on-chain"
          ? "The previous badge was burned on-chain."
          : payload.resetMode === "rotated-wallet"
            ? "A fresh demo wallet was provisioned for another mint."
            : "The local claim state was refreshed.";

      setBanner(
        `${resetNote} ${payload.claimEmailSent ? "A fresh claim email was sent." : "Use the updated claim link on this page."}`,
        "success",
      );
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  async function handleClaim() {
    setBusyState("claim");
    setBanner("Minting your soulbound badge...", "info");

    try {
      const payload = await apiRequest("/api/claims/claim", {
        method: "POST",
        body: claimToken ? { claimToken } : {},
        authToken,
      });

      if (payload.account) {
        setAccount(payload.account);
      } else {
        await loadAccountData(authToken);
      }

      if (claimToken) {
        await loadClaimData(claimToken);
      }

      setBanner(
        payload.alreadyClaimed
          ? "This badge was already claimed earlier."
          : "Badge minted successfully. The verification link is now active in your badge list.",
        "success",
      );
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  function handleSignOut() {
    setAuthToken("");
    window.localStorage.removeItem(authStorageKey);
    setAccount(null);
    setBanner("Signed out locally.", "info");
  }

  if (pageLoading && !dashboard) {
    return html`
      <div className="min-h-screen bg-shell">
        <${Sidebar} active="claim" />
        <div className="min-h-screen lg:pl-72">
          <${Topbar}
            searchValue=${searchValue}
            onSearchChange=${setSearchValue}
            searchPlaceholder="Search help..."
          />
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <${LoadingPanel} label="Loading claim portal..." />
          </main>
        </div>
      </div>
    `;
  }

  const authCopy = {
    login: {
      title: "Sign in",
      description: claimToken
        ? "Use the same email that received the claim invitation."
        : "Sign in to access your wallet, badges, and claimable guests.",
      badgeTone: claimToken ? "accent" : "neutral",
      badgeLabel: claimToken ? "Claim link detected" : "General access",
    },
    register: {
      title: "Create account",
      description: "New accounts automatically receive a wallet address for minting.",
      badgeTone: "success",
      badgeLabel: "Wallet auto-created",
    },
    forgot: {
      title: "Forgot password",
      description: "Delete stored local account details for this email so it can be created again.",
      badgeTone: "neutral",
      badgeLabel: "Local reset only",
    },
  }[authView];

  return html`
    <div className="min-h-screen bg-shell">
      <${Sidebar} active="claim" />

      <div className="min-h-screen lg:pl-72">
        <${Topbar}
          searchValue=${searchValue}
          onSearchChange=${setSearchValue}
          searchPlaceholder=${isAuthenticated ? "Search badges..." : "Search help..."}
        />

        <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <${PageHeader}
            eyebrow="Claim Portal"
            title=${`Claim your ${dashboard?.event?.name || "Badge Pop"} attendance badge`}
            description=${isAuthenticated
              ? "Your account is connected. Review the claim context, wallet details, and minted badges before completing the attendance claim."
              : "Sign in with the email from your claim invite first. If this is your first visit, create the account here and the wallet will be set up automatically."}
            actions=${html`
              ${isAuthenticated
                ? html`
                    <button
                      type="button"
                      onClick=${handleClaim}
                      disabled=${busyState === "claim" || !authToken || !claimToken}
                      className=${primaryButtonClass}
                    >
                      ${busyState === "claim" ? "Minting badge..." : "Mint badge now"}
                    </button>
                    <button type="button" onClick=${handleSignOut} className=${secondaryButtonClass}>
                      Sign out
                    </button>
                  `
                : null}
              <a href="/" className=${secondaryButtonClass}>Back to dashboard</a>
            `}
            meta=${[
              html`<${MetaCard} label="Event ID" value=${dashboard?.event?.id || "Unavailable"} mono=${true} />`,
              html`<${MetaCard}
                label="Blockchain Claims"
                value=${dashboard?.platform?.chainConfigured ? "Enabled" : "Waiting for config"}
              />`,
            ]}
          />

          ${notice ? html`<div className="mt-6"><${NoticeBanner} message=${notice.message} tone=${notice.tone} /></div>` : null}

          ${!isAuthenticated
            ? html`
                <section className="mt-6">
                  <${PanelCard}
                    eyebrow="Access"
                    title=${authCopy.title}
                    description=${authCopy.description}
                    className="mx-auto w-full max-w-2xl"
                  >
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-50/70 px-4 py-3">
                        <${StatusBadge} tone=${authCopy.badgeTone}>${authCopy.badgeLabel}</${StatusBadge}>
                        ${claimToken
                          ? html`<span className="text-sm text-navy-500">This page was opened from a claim link.</span>`
                          : html`<span className="text-sm text-navy-500">Choose an action to continue.</span>`}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        ${[
                          ["login", "Sign in"],
                          ["register", "Create account"],
                          ["forgot", "Forgot password"],
                        ].map(
                          ([mode, label]) => html`
                            <button
                              type="button"
                              onClick=${() => setAuthView(mode)}
                              className=${cx(
                                authView === mode
                                  ? "inline-flex items-center justify-center rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
                                  : secondaryButtonClass,
                                "w-full",
                              )}
                            >
                              ${label}
                            </button>
                          `,
                        )}
                      </div>

                      ${authView === "login"
                        ? html`
                            <form className="space-y-4" onSubmit=${handleLogin}>
                              <${Field} label="Email" htmlFor="loginEmail">
                                <input
                                  id="loginEmail"
                                  type="email"
                                  required
                                  autoComplete="email"
                                  className=${inputClass}
                                  value=${loginForm.email}
                                  onInput=${(event) => {
                                    const value = event.currentTarget.value;
                                    setLoginForm((current) => ({ ...current, email: value }));
                                  }}
                                />
                              </${Field}>
                              <${Field} label="Password" htmlFor="loginPassword">
                                <input
                                  id="loginPassword"
                                  type="password"
                                  required
                                  autoComplete="current-password"
                                  className=${inputClass}
                                  value=${loginForm.password}
                                  onInput=${(event) => {
                                    const value = event.currentTarget.value;
                                    setLoginForm((current) => ({ ...current, password: value }));
                                  }}
                                />
                              </${Field}>
                              <button
                                type="submit"
                                disabled=${busyState === "login"}
                                className=${cx(primaryButtonClass, "w-full")}
                              >
                                ${busyState === "login" ? "Signing in..." : "Sign in"}
                              </button>
                            </form>
                          `
                        : null}

                      ${authView === "register"
                        ? html`
                            <form className="space-y-4" onSubmit=${handleRegister}>
                              <${Field} label="Email" htmlFor="registerEmail">
                                <input
                                  id="registerEmail"
                                  type="email"
                                  required
                                  autoComplete="email"
                                  className=${inputClass}
                                  value=${registerForm.email}
                                  onInput=${(event) => {
                                    const value = event.currentTarget.value;
                                    setRegisterForm((current) => ({ ...current, email: value }));
                                  }}
                                />
                              </${Field}>
                              <${Field} label="Password" htmlFor="registerPassword" hint="Use at least 8 characters.">
                                <input
                                  id="registerPassword"
                                  type="password"
                                  required
                                  minLength=${8}
                                  autoComplete="new-password"
                                  className=${inputClass}
                                  value=${registerForm.password}
                                  onInput=${(event) => {
                                    const value = event.currentTarget.value;
                                    setRegisterForm((current) => ({ ...current, password: value }));
                                  }}
                                />
                              </${Field}>
                              <button
                                type="submit"
                                disabled=${busyState === "register"}
                                className=${cx(primaryButtonClass, "w-full")}
                              >
                                ${busyState === "register" ? "Creating account..." : "Create account"}
                              </button>
                            </form>
                          `
                        : null}

                      ${authView === "forgot"
                        ? html`
                            <form className="space-y-4" onSubmit=${handleForgotPassword}>
                              <${Field} label="Email" htmlFor="forgotPasswordEmail">
                                <input
                                  id="forgotPasswordEmail"
                                  type="email"
                                  required
                                  autoComplete="email"
                                  className=${inputClass}
                                  value=${forgotEmail}
                                  onInput=${(event) => {
                                    const value = event.currentTarget.value;
                                    setForgotEmail(value);
                                  }}
                                />
                              </${Field}>
                              <button
                                type="submit"
                                disabled=${busyState === "forgot"}
                                className=${cx(primaryButtonClass, "w-full")}
                              >
                                ${busyState === "forgot" ? "Resetting..." : "Reset"}
                              </button>
                            </form>
                          `
                        : null}
                    </div>
                  </${PanelCard}>
                </section>
              `
            : html`
                <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                  <${PanelCard}
                    eyebrow="Invite"
                    title="Claim context"
                    description="The guest record tied to the claim link you opened."
                  >
                    <${ClaimContextCard} token=${claimToken} context=${context} loading=${contextLoading} />
                  </${PanelCard}>

                  <${PanelCard}
                    eyebrow="Account"
                    title="Wallet identity"
                    description="The platform wallet that receives minted badges."
                  >
                    <${AccountCard} account=${account} />
                  </${PanelCard}>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
                  <${PanelCard}
                    eyebrow="Ready"
                    title="Claim readiness"
                    description="Quick view of the requirements before minting can proceed."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Account</p>
                        <div className="mt-3 flex items-center gap-2">
                          <${StatusBadge} tone="success">Connected</${StatusBadge}>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Claim invite</p>
                        <div className="mt-3 flex items-center gap-2">
                          <${StatusBadge} tone=${claimToken ? "accent" : "neutral"}>
                            ${claimToken ? "Loaded" : "Missing"}
                          </${StatusBadge}>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Check-in</p>
                        <div className="mt-3 flex items-center gap-2">
                          <${StatusBadge} tone=${context?.guest?.checkedInAt ? "success" : "neutral"}>
                            ${context?.guest?.checkedInAt ? "Verified" : "Pending"}
                          </${StatusBadge}>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Wallet badges</p>
                        <div className="mt-3 flex items-center gap-2">
                          <${StatusBadge} tone=${account?.badges?.length ? "accent" : "neutral"}>
                            ${account?.badges?.length ? `${account.badges.length} minted` : "None yet"}
                          </${StatusBadge}>
                        </div>
                      </div>
                    </div>
                  </${PanelCard}>

                  <${PanelCard}
                    eyebrow="Portfolio"
                    title="Minted badges"
                    description="Issued attendance tokens and their verification links."
                  >
                    <${BadgeGrid} badges=${account?.badges || []} query=${deferredSearch} />
                  </${PanelCard}>
                </section>

                <section className="mt-6">
                  <${PanelCard}
                    eyebrow="Testing"
                    title="Refresh claim for testing"
                    description="Use this only for local demos. If burning is unavailable, the app can rotate to a fresh demo wallet for another mint."
                  >
                    <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit=${handleRefreshClaim}>
                      <${Field}
                        label="Current password"
                        htmlFor="claimRefreshPassword"
                        hint="Only needed when the old badge cannot be burned on-chain."
                      >
                        <input
                          id="claimRefreshPassword"
                          type="password"
                          autoComplete="current-password"
                          className=${inputClass}
                          placeholder="Optional unless wallet rotation is needed"
                          value=${refreshPassword}
                          onInput=${(event) => {
                            const value = event.currentTarget.value;
                            setRefreshPassword(value);
                          }}
                        />
                      </${Field}>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled=${busyState === "refresh"}
                          className=${cx(primaryButtonClass, "w-full lg:w-auto")}
                        >
                          ${busyState === "refresh" ? "Refreshing..." : "Refresh claim"}
                        </button>
                      </div>
                    </form>
                  </${PanelCard}>
                </section>
              `}
        </main>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`
  <${ClaimErrorBoundary}>
    <${ClaimApp} />
  </${ClaimErrorBoundary}>
`);
