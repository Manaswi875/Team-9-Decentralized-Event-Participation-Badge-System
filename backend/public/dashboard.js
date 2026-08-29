import React, {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const authStorageKey = "badgepop-auth-token";

const shellCardClass = "rounded-xl border border-border bg-surface shadow-panel";

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

async function apiRequest(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof payload === "string"
        ? payload
        : payload.details || payload.error || "Something went wrong.",
    );
  }

  return payload;
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

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return "GP";
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function IconBase({ className = "", children }) {
  return html`
    <svg
      className=${className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      ${children}
    </svg>
  `;
}

function LogoIcon({ className = "h-8 w-8" }) {
  return html`
    <div className=${cx("grid place-items-center rounded-xl bg-navy-900 text-white", className)}>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7.5h16" />
        <path d="M7 4.5v6" />
        <path d="M17 4.5v6" />
        <path d="M5 10.5h14a1 1 0 0 1 1 1v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a1 1 0 0 1 1-1Z" />
        <path d="M9 14h.01" />
        <path d="M15 14h.01" />
      </svg>
    </div>
  `;
}

function SearchIcon({ className = "h-4 w-4" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </${IconBase}>
  `;
}

function BellIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 14 6 8" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </${IconBase}>
  `;
}

function HelpIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2.25-3 4" />
      <path d="M12 17h.01" />
    </${IconBase}>
  `;
}

function ScannerIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M7 3H5a2 2 0 0 0-2 2v2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M17 21h2a2 2 0 0 0 2-2v-2" />
      <path d="M7 12h10" />
      <path d="M9 8h6" />
      <path d="M9 16h6" />
    </${IconBase}>
  `;
}

function PortalIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M8 9h8" />
      <path d="M8 13h4" />
      <path d="M14 13h2" />
    </${IconBase}>
  `;
}

function DashboardIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4.5" rx="1.5" />
      <rect x="13" y="11.5" width="7" height="8.5" rx="1.5" />
      <rect x="4" y="13.5" width="7" height="6.5" rx="1.5" />
    </${IconBase}>
  `;
}

function SettingsIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 3v2.5" />
      <path d="M12 18.5V21" />
      <path d="m4.9 4.9 1.8 1.8" />
      <path d="m17.3 17.3 1.8 1.8" />
      <path d="M3 12h2.5" />
      <path d="M18.5 12H21" />
      <path d="m4.9 19.1 1.8-1.8" />
      <path d="m17.3 6.7 1.8-1.8" />
      <circle cx="12" cy="12" r="3.5" />
    </${IconBase}>
  `;
}

function LogoutIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M15 16.5 20 12l-5-4.5" />
      <path d="M20 12H9" />
      <path d="M11 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h4" />
    </${IconBase}>
  `;
}

function UsersIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M20 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M15.5 4.85a3.5 3.5 0 0 1 0 6.3" />
    </${IconBase}>
  `;
}

function CheckIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3 4.7-5.1" />
    </${IconBase}>
  `;
}

function BadgeIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 3 7 5v5c0 4 2.2 7.4 5 9 2.8-1.6 5-5 5-9V5Z" />
      <path d="m9.5 10.5 1.5 1.5 3.5-3.5" />
    </${IconBase}>
  `;
}

function MailIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </${IconBase}>
  `;
}

function PlusIcon({ className = "h-4 w-4" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </${IconBase}>
  `;
}

function QrIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M15 15h1v1h-1z" />
      <path d="M18 14v3" />
      <path d="M14 18h3" />
      <path d="M18 18h2v2" />
    </${IconBase}>
  `;
}

function EmptyIcon({ className = "h-10 w-10" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="m7 9 5 4 5-4" />
    </${IconBase}>
  `;
}

function StatusBadge({ tone = "neutral", children }) {
  const toneClass = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    neutral: "bg-slate-100 text-navy-500 ring-1 ring-inset ring-slate-200",
    accent: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    warn: "bg-slate-100 text-navy-700 ring-1 ring-inset ring-slate-200",
  }[tone];

  return html`
    <span
      className=${cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.02em]",
        toneClass,
      )}
    >
      ${children}
    </span>
  `;
}

function Sidebar() {
  const navItems = [
    { label: "Dashboard", href: "/", active: true, icon: DashboardIcon },
    { label: "Event Scanner", href: "/staff", active: false, icon: ScannerIcon },
    { label: "Claim Portal", href: "/claim", active: false, icon: PortalIcon },
  ];

  return html`
    <aside className="w-full border-b border-border bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <${LogoIcon} />
            <div>
              <p className="text-lg font-semibold tracking-tight text-navy-900">Badge Pop</p>
              <p className="text-sm text-navy-500">Attendance operations</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto px-4 py-4 lg:flex-1 lg:flex-col lg:items-stretch lg:overflow-visible">
          ${navItems.map((item) => {
            const Icon = item.icon;
            return html`
              <a
                href=${item.href}
                className=${cx(
                  "group relative flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 lg:min-w-0",
                  item.active
                    ? "bg-blue-50 text-blue-700 shadow-sm before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-1 before:rounded-full before:bg-accent lg:before:left-0"
                    : "text-navy-700 hover:bg-slate-100 hover:text-navy-900",
                )}
              >
                <${Icon} className=${cx("h-5 w-5", item.active ? "text-blue-600" : "text-navy-500")} />
                <span>${item.label}</span>
              </a>
            `;
          })}
        </nav>
      </div>
    </aside>
  `;
}

function Topbar({ searchValue, onSearchChange }) {
  return html`
    <header className="sticky top-0 z-20 border-b border-border bg-shell/95 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 ring-1 ring-inset ring-blue-200">
            Production
          </span>
          <span className="hidden text-sm text-navy-500 sm:inline">Light operations console</span>
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
          <label className="relative block flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-navy-500">
              <${SearchIcon} />
            </span>
            <input
              value=${searchValue}
              onInput=${(event) =>
                startTransition(() => {
                  onSearchChange(event.currentTarget.value);
                })}
              type="search"
              placeholder="Search guests..."
              className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-navy-900 placeholder:text-navy-500 focus:border-blue-400 focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              aria-label="Notifications"
            >
              <${BellIcon} />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              aria-label="Help"
            >
              <${HelpIcon} />
            </button>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 shadow-sm">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                BP
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-navy-900">Badge Pop</p>
                <p className="text-xs text-navy-500">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function StatCard({ label, value, note, icon }) {
  return html`
    <div className=${cx(shellCardClass, "p-5 transition hover:border-blue-200 hover:shadow-sm")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">${label}</p>
          <p className="mt-4 text-4xl font-bold tracking-tight text-navy-900">${value}</p>
          <p className="mt-2 text-sm leading-6 text-navy-500">${note}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          ${icon}
        </div>
      </div>
    </div>
  `;
}

function SectionHeader({ eyebrow, title, description, actions = null }) {
  return html`
    <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        ${eyebrow
          ? html`<p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">${eyebrow}</p>`
          : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-navy-900">${title}</h2>
        ${description ? html`<p className="mt-2 text-sm leading-6 text-navy-500">${description}</p>` : null}
      </div>
      ${actions}
    </div>
  `;
}

function EmptyState({ icon, title, description, compact = false }) {
  return html`
    <div
      className=${cx(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-navy-500">
        ${icon}
      </div>
      <p className="mt-4 text-base font-semibold text-navy-900">${title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-navy-500">${description}</p>
    </div>
  `;
}

function GuestTable({ guests, searchTerm }) {
  const trimmedQuery = searchTerm.trim();
  const isFilteredEmpty = Boolean(trimmedQuery) && !guests.length;

  return html`
    <section className=${shellCardClass}>
      <${SectionHeader}
        eyebrow="Registry"
        title="Guest Registry"
        description="Search, verify, and monitor every attendee linked to your event."
      />

      ${guests.length
        ? html`
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Access</th>
                    <th className="px-5 py-4">Approval</th>
                    <th className="px-5 py-4">Check-In</th>
                    <th className="px-5 py-4">Badge</th>
                    <th className="px-5 py-4">Wallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  ${guests.map(
                    (guest) => html`
                      <tr className="align-top transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-navy-900">
                              ${getInitials(guest.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-navy-900">${guest.name}</p>
                              <p className="mt-1 truncate text-sm text-navy-500">${guest.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-navy-900">${guest.ticketName || "General Admission"}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-navy-700">
                              ${guest.checkInCode}
                            </span>
                            <a
                              href=${guest.qrImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              <${QrIcon} className="h-4 w-4" />
                              Open QR
                            </a>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <${StatusBadge} tone=${guest.approvalStatus === "approved" ? "success" : "neutral"}>
                            ${guest.approvalStatus === "approved" ? "Approved" : guest.approvalStatus || "Pending"}
                          </${StatusBadge}>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-navy-900">
                            ${guest.checkedInAt ? "Checked in" : "Not yet"}
                          </p>
                          <p className="mt-1 text-sm text-navy-500">
                            ${guest.checkedInAt ? formatDate(guest.checkedInAt) : "Awaiting first scan"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <${StatusBadge} tone=${guest.claimStatus === "claimed" ? "accent" : "neutral"}>
                            ${guest.claimStatus === "claimed" ? "Claimed" : "Unclaimed"}
                          </${StatusBadge}>
                          <p className="mt-2 text-sm text-navy-500">
                            ${guest.badgeTokenId ? `Token #${guest.badgeTokenId}` : "No badge minted yet"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-[220px] truncate text-sm font-medium text-navy-900">
                            ${guest.walletAddress || "No wallet yet"}
                          </p>
                          <p className="mt-2 text-sm text-navy-500">
                            ${guest.verifyUrl
                              ? html`
                                  <a
                                    href=${guest.verifyUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    Verify badge
                                  </a>
                                `
                              : "Verification appears after mint"}
                          </p>
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
        : html`
            <${EmptyState}
              compact=${false}
              icon=${html`<${UsersIcon} className="h-6 w-6" />`}
              title=${isFilteredEmpty ? "No guests match your search." : "No guests yet."}
              description=${isFilteredEmpty
                ? `Try a different search term instead of "${trimmedQuery}".`
                : "Guests will appear here automatically after attendees RSVP."}
            />
          `}
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

function SystemStateCard({ event, platform }) {
  return html`
    <section className=${shellCardClass}>
      <${SectionHeader}
        eyebrow="Overview"
        title="System State"
        description="Operational details for the current event environment."
      />
      <div className="divide-y divide-border px-5 py-2">
        <${DetailRow} label="Event ID" value=${event?.id || "Unconfigured"} mono=${true} />
        <${DetailRow} label="Event Name" value=${event?.name || "Badge Pop Event"} />
        <${DetailRow} label="Email Mode" value=${platform?.deliveryMode || "Preview"} />
        <${DetailRow}
          label="Blockchain Claims"
          value=${platform?.chainConfigured ? "Enabled" : "Waiting for env config"}
        />
        <${DetailRow}
          label="Contract"
          value=${platform?.contractAddress || "Not configured"}
          mono=${true}
        />
      </div>
    </section>
  `;
}

function RecentCheckinsCard({ guests }) {
  return html`
    <section className=${shellCardClass}>
      <${SectionHeader}
        eyebrow="Live"
        title="Recent Check-Ins"
        description="The latest guests confirmed at the venue entrance."
      />
      <div className="px-5 py-4">
        ${guests.length
          ? html`
              <div className="space-y-4">
                ${guests.map(
                  (guest) => html`
                    <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-navy-900">
                        ${getInitials(guest.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900">${guest.name}</p>
                        <p className="mt-1 truncate text-sm text-navy-500">${guest.email}</p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-navy-500">
                          ${formatDate(guest.checkedInAt)}
                        </p>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
          : html`
              <${EmptyState}
                compact=${true}
                icon=${html`<${CheckIcon} className="h-6 w-6" />`}
                title="No check-ins yet."
                description="Guests will appear here after their QR codes are scanned at the event."
              />
            `}
      </div>
    </section>
  `;
}

function EmailOutboxCard({ emails }) {
  return html`
    <section className=${shellCardClass}>
      <${SectionHeader}
        eyebrow="Messages"
        title="Email Outbox"
        description="Generated check-in and claim messages for the current event."
      />
      ${emails.length
        ? html`
            <div className="divide-y divide-border">
              ${emails.map(
                (email) => html`
                  <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-navy-900">${email.subject}</p>
                        <${StatusBadge} tone=${email.deliveryMode === "smtp" ? "accent" : "neutral"}>
                          ${String(email.deliveryMode || "preview").toUpperCase()}
                        </${StatusBadge}>
                      </div>
                      <p className="mt-1 text-sm text-navy-500">
                        ${email.to} · ${formatDate(email.sentAt)}
                      </p>
                    </div>
                    <a
                      href=${email.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-navy-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <${MailIcon} className="h-4 w-4" />
                      Open preview
                    </a>
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div className="px-5 py-6">
              <${EmptyState}
                icon=${html`<${EmptyIcon} className="h-6 w-6" />`}
                title="No emails yet."
                description="Registration and claim emails will appear here once guests begin moving through the flow."
              />
            </div>
          `}
    </section>
  `;
}

function NoticeBanner({ message, tone = "info" }) {
  const toneClass = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return html`
    <div className=${cx("mb-6 rounded-xl border px-4 py-3 text-sm font-medium", toneClass)}>
      ${message}
    </div>
  `;
}

function LoadingCard() {
  return html`
    <div className=${cx(shellCardClass, "p-10")}>
      <div className="flex items-center gap-3 text-sm font-medium text-navy-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500"></span>
        Loading dashboard...
      </div>
    </div>
  `;
}

function DashboardApp() {
  const [dashboard, setDashboard] = useState(null);
  const [guests, setGuests] = useState([]);
  const [emails, setEmails] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const deferredSearch = useDeferredValue(searchValue);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [dashboardPayload, guestsPayload, emailsPayload] = await Promise.all([
          apiRequest("/api/dashboard"),
          apiRequest("/api/guests"),
          apiRequest("/api/emails"),
        ]);

        if (!active) {
          return;
        }

        setDashboard(dashboardPayload);
        setGuests(guestsPayload.guests || []);
        setEmails(emailsPayload.emails || []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError.message || "Could not load the dashboard.");
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const filteredGuests = guests.filter((guest) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [guest.name, guest.email, guest.checkInCode, guest.ticketName]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

  const stats = dashboard?.stats || {
    totalGuests: 0,
    checkedInGuests: 0,
    claimedBadges: 0,
    registrationEmailCount: 0,
    claimEmailCount: 0,
  };
  const recentCheckIns = dashboard?.recentCheckIns || [];
  const totalEmails = Number(stats.registrationEmailCount || 0) + Number(stats.claimEmailCount || 0);

  return html`
    <div className="min-h-screen bg-shell">
      <${Sidebar} />

      <div className="min-h-screen lg:pl-72">
        <${Topbar} searchValue=${searchValue} onSearchChange=${setSearchValue} />

        <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Operations Console</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
                Event Scanner Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-navy-500">
                Monitor guests, venue check-ins, badge claims, and outgoing messages from a single white-first workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/staff"
                className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]"
              >
                <${ScannerIcon} className="h-4 w-4" />
                Open Scanner
              </a>
              <a
                href="/claim"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <${PortalIcon} className="h-4 w-4" />
                Claim Portal
              </a>
            </div>
          </header>

          ${error ? html`<${NoticeBanner} message=${error} tone="error" />` : null}

          ${dashboard
            ? html`
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <${StatCard}
                    label="Guests"
                    value=${stats.totalGuests}
                    note=${`${stats.totalGuests === 1 ? "1 guest is" : `${stats.totalGuests} guests are`} currently in the system.`}
                    icon=${html`<${UsersIcon} className="h-5 w-5" />`}
                  />
                  <${StatCard}
                    label="Checked In"
                    value=${stats.checkedInGuests}
                    note=${`${stats.claimableGuests} ${stats.claimableGuests === 1 ? "guest is" : "guests are"} ready to claim.`}
                    icon=${html`<${CheckIcon} className="h-5 w-5" />`}
                  />
                  <${StatCard}
                    label="Claimed"
                    value=${stats.claimedBadges}
                    note=${`${stats.accountsCreated} ${stats.accountsCreated === 1 ? "account has" : "accounts have"} been created.`}
                    icon=${html`<${BadgeIcon} className="h-5 w-5" />`}
                  />
                  <${StatCard}
                    label="Emails Sent"
                    value=${totalEmails}
                    note=${`${stats.registrationEmailCount} check-in and ${stats.claimEmailCount} claim emails have been generated.`}
                    icon=${html`<${MailIcon} className="h-5 w-5" />`}
                  />
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
                  <div className="space-y-6">
                    <${GuestTable}
                      guests=${filteredGuests}
                      searchTerm=${deferredSearch}
                    />
                    <${EmailOutboxCard} emails=${emails} />
                  </div>

                  <div className="space-y-6">
                    <${SystemStateCard} event=${dashboard.event} platform=${dashboard.platform} />
                    <${RecentCheckinsCard} guests=${recentCheckIns} />
                  </div>
                </section>
              `
            : html`<${LoadingCard} />`}
        </main>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${DashboardApp} />`);
