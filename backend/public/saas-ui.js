import React, {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

export { React, createRoot, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState };

export const html = htm.bind(React.createElement);
export const authStorageKey = "badgepop-auth-token";

export const shellCardClass = "rounded-xl border border-border bg-surface shadow-panel";
export const inputClass =
  "h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-navy-900 placeholder:text-navy-500 focus:border-blue-400 focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]";
export const textareaClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-navy-900 placeholder:text-navy-500 focus:border-blue-400 focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]";
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-[rgba(59,130,246,0.15)] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-[rgba(59,130,246,0.15)] disabled:cursor-not-allowed disabled:opacity-50";
export const iconButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]";

export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export async function apiRequest(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (options.auth !== false && options.authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${options.authToken}`;
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

    throw new Error("Could not reach the backend API. Make sure the backend server is running and reload the page.");
  }

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

export function formatDate(value) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return "BP";
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

export function getClaimToken() {
  return new URLSearchParams(window.location.search).get("token");
}

export function replaceClaimPageUrl(claimUrl) {
  const nextUrl = new URL(claimUrl, window.location.origin);
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
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

export function LogoIcon({ className = "h-8 w-8" }) {
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

export function SearchIcon({ className = "h-4 w-4" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </${IconBase}>
  `;
}

export function BellIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 14 6 8" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </${IconBase}>
  `;
}

export function HelpIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2.25-3 4" />
      <path d="M12 17h.01" />
    </${IconBase}>
  `;
}

export function ScannerIcon({ className = "h-5 w-5" }) {
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

export function PortalIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M8 9h8" />
      <path d="M8 13h4" />
      <path d="M14 13h2" />
    </${IconBase}>
  `;
}

export function DashboardIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4.5" rx="1.5" />
      <rect x="13" y="11.5" width="7" height="8.5" rx="1.5" />
      <rect x="4" y="13.5" width="7" height="6.5" rx="1.5" />
    </${IconBase}>
  `;
}

export function SettingsIcon({ className = "h-5 w-5" }) {
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

export function LogoutIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M15 16.5 20 12l-5-4.5" />
      <path d="M20 12H9" />
      <path d="M11 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h4" />
    </${IconBase}>
  `;
}

export function CheckIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3 4.7-5.1" />
    </${IconBase}>
  `;
}

export function BadgeIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 3 7 5v5c0 4 2.2 7.4 5 9 2.8-1.6 5-5 5-9V5Z" />
      <path d="m9.5 10.5 1.5 1.5 3.5-3.5" />
    </${IconBase}>
  `;
}

export function MailIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </${IconBase}>
  `;
}

export function CameraIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </${IconBase}>
  `;
}

export function QrIcon({ className = "h-5 w-5" }) {
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

export function ShieldIcon({ className = "h-5 w-5" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 3 7 5v5c0 4 2.2 7.4 5 9 2.8-1.6 5-5 5-9V5Z" />
      <path d="m9.5 12 1.5 1.5 3-3" />
    </${IconBase}>
  `;
}

export function PlusIcon({ className = "h-4 w-4" }) {
  return html`
    <${IconBase} className=${className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </${IconBase}>
  `;
}

export function StatusBadge({ tone = "neutral", children }) {
  const toneClass = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    neutral: "bg-slate-100 text-navy-500 ring-1 ring-inset ring-slate-200",
    accent: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    warn: "bg-slate-100 text-navy-700 ring-1 ring-inset ring-slate-200",
    danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
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

export function NoticeBanner({ message, tone = "info" }) {
  if (!message) {
    return null;
  }

  const toneClass = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return html`
    <div className=${cx("rounded-xl border px-4 py-3 text-sm font-medium", toneClass)}>
      ${message}
    </div>
  `;
}

export function EmptyState({ icon, title, description, compact = false }) {
  return html`
    <div
      className=${cx(
        "rounded-xl border border-dashed border-border bg-slate-50/70 text-center",
        compact ? "px-4 py-8" : "px-6 py-10",
      )}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-500 shadow-sm ring-1 ring-inset ring-border">
        ${icon}
      </div>
      <p className="mt-4 text-base font-semibold text-navy-900">${title}</p>
      <p className="mt-2 text-sm leading-6 text-navy-500">${description}</p>
    </div>
  `;
}

export function MetaCard({ label, value, mono = false }) {
  return html`
    <div className=${cx(shellCardClass, "p-4")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-500">${label}</p>
      <p className=${cx("mt-2 text-sm font-semibold text-navy-900", mono && "font-mono text-xs sm:text-sm")}>
        ${value}
      </p>
    </div>
  `;
}

export function DetailRow({ label, value, mono = false }) {
  return html`
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-navy-500">${label}</span>
      <span
        className=${cx(
          "min-w-0 max-w-[65%] text-right text-sm font-medium text-navy-900",
          mono ? "break-all font-mono text-xs sm:text-sm" : "break-words",
        )}
      >
        ${value}
      </span>
    </div>
  `;
}

export function Sidebar({ active = "dashboard" }) {
  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/", icon: DashboardIcon },
    { key: "scanner", label: "Event Scanner", href: "/staff", icon: ScannerIcon },
    { key: "claim", label: "Claim Portal", href: "/claim", icon: PortalIcon },
  ];

  return html`
    <aside className="w-full border-b border-border bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <a href="/" className="border-b border-border px-5 py-5 no-underline">
          <div className="flex items-center gap-3">
            <${LogoIcon} />
            <div>
              <p className="text-lg font-semibold tracking-tight text-navy-900">Badge Pop</p>
              <p className="text-sm text-navy-500">Attendance operations</p>
            </div>
          </div>
        </a>

        <nav className="flex items-center gap-2 overflow-x-auto px-4 py-4 lg:flex-1 lg:flex-col lg:items-stretch lg:overflow-visible">
          ${navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;

            return html`
              <a
                href=${item.href}
                className=${cx(
                  "group relative flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium no-underline transition-all duration-150 lg:min-w-0",
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-1 before:rounded-full before:bg-accent lg:before:left-0"
                    : "text-navy-700 hover:bg-slate-100 hover:text-navy-900",
                )}
              >
                <${Icon} className=${cx("h-5 w-5", isActive ? "text-blue-600" : "text-navy-500")} />
                <span>${item.label}</span>
              </a>
            `;
          })}
        </nav>
      </div>
    </aside>
  `;
}

export function Topbar({
  searchValue = "",
  onSearchChange = null,
  searchPlaceholder = "Search guests...",
}) {
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
              onInput=${(event) => {
                if (onSearchChange) {
                  const value = event.currentTarget.value;
                  startTransition(() => onSearchChange(value));
                }
              }}
              type="search"
              placeholder=${searchPlaceholder}
              className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-navy-900 placeholder:text-navy-500 focus:border-blue-400 focus:ring-4 focus:ring-[rgba(59,130,246,0.15)]"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className=${iconButtonClass} aria-label="Notifications">
              <${BellIcon} />
            </button>
            <button type="button" className=${iconButtonClass} aria-label="Help">
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

export function PageHeader({ eyebrow, title, description, actions = null, meta = null }) {
  return html`
    <header className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">${eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">${title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-navy-500">${description}</p>
        ${actions ? html`<div className="mt-5 flex flex-wrap gap-3">${actions}</div>` : null}
      </div>
      ${meta
        ? html`
            <div className="grid min-w-full gap-3 sm:grid-cols-2 xl:min-w-[340px] xl:max-w-[420px]">
              ${meta}
            </div>
          `
        : null}
    </header>
  `;
}

export function SectionHeader({ eyebrow = null, title, description, actions = null }) {
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

export function Field({ label, htmlFor, hint = null, children }) {
  return html`
    <div className="space-y-2">
      <label htmlFor=${htmlFor} className="block text-sm font-medium text-navy-700">${label}</label>
      ${children}
      ${hint ? html`<p className="text-xs leading-5 text-navy-500">${hint}</p>` : null}
    </div>
  `;
}
