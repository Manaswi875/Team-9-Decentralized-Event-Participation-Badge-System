import {
  CameraIcon,
  CheckIcon,
  EmptyState,
  Field,
  MailIcon,
  MetaCard,
  NoticeBanner,
  PageHeader,
  QrIcon,
  ScannerIcon,
  SectionHeader,
  Sidebar,
  StatusBadge,
  Topbar,
  authStorageKey,
  apiRequest,
  createRoot,
  cx,
  formatDate,
  getInitials,
  html,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellCardClass,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "./saas-ui.js";

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

function ScanResultCard({ result }) {
  if (!result?.guest) {
    return null;
  }

  return html`
    <${PanelCard}
      eyebrow="Latest Result"
      title="Check-in confirmed"
      description="The most recent scanned attendee and claim email result."
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-navy-900">${result.guest.name}</p>
            <p className="mt-1 text-sm text-navy-500">${result.guest.email}</p>
          </div>
          <${StatusBadge} tone=${result.alreadyCheckedIn ? "neutral" : "success"}>
            ${result.alreadyCheckedIn ? "Already checked in" : "Checked in now"}
          </${StatusBadge}>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Claim email</p>
            <p className="mt-3 text-sm font-medium text-navy-900">
              ${result.claimEmailSent ? "Sent just now" : "Already sent earlier"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-500">Fallback code</p>
            <p className="mt-3 font-mono text-sm text-navy-900">${result.guest.checkInCode || "Unavailable"}</p>
          </div>
        </div>
        <a
          href=${result.claimUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
        >
          Open claim link
        </a>
      </div>
    </${PanelCard}>
  `;
}

function RecentActivityCard({ guests, query }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filteredGuests = guests.filter((guest) => {
    if (!normalizedQuery) {
      return true;
    }

    return [guest.name, guest.email, guest.checkInCode]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
  });

  return html`
    <${PanelCard}
      eyebrow="Activity"
      title="Recent scan activity"
      description="The latest verified arrivals, refreshed after each successful scan."
      className="xl:col-span-2"
    >
      ${filteredGuests.length
        ? html`
            <div className="space-y-3">
              ${filteredGuests.map(
                (guest) => html`
                  <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-navy-900">
                      ${getInitials(guest.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="truncate text-sm font-semibold text-navy-900">${guest.name}</p>
                          <p className="mt-1 truncate text-sm text-navy-500">${guest.email}</p>
                        </div>
                        <${StatusBadge} tone="success">Checked in</${StatusBadge}>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium uppercase tracking-[0.14em] text-navy-500">
                        <span>${formatDate(guest.checkedInAt)}</span>
                        <span>${guest.checkInCode}</span>
                      </div>
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
              title=${normalizedQuery ? "No recent scans match your search." : "No scan activity yet."}
              description=${normalizedQuery
                ? `Try another search term instead of "${query}".`
                : "Scanned guests will appear here as soon as check-in begins."}
            />
          `}
    </${PanelCard}>
  `;
}

function StaffApp() {
  const [dashboard, setDashboard] = useState(null);
  const [guests, setGuests] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [busyState, setBusyState] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const deferredSearch = useDeferredValue(searchValue);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  function setBanner(message, tone = "info") {
    setNotice(message ? { message, tone } : null);
  }

  function stopCamera({ silent = false } = {}) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);

    if (!silent) {
      setBanner("Camera scanner stopped.", "info");
    }
  }

  async function loadStaffData() {
    const [dashboardPayload, guestsPayload] = await Promise.all([
      apiRequest("/api/dashboard", { auth: false }),
      apiRequest("/api/guests", { auth: false }),
    ]);

    setDashboard(dashboardPayload);
    setGuests(guestsPayload.guests || []);
    return { dashboardPayload, guestsPayload };
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadStaffData();
      } catch (error) {
        if (!active) {
          return;
        }

        setBanner(error.message || "Could not load the staff scanner.", "error");
      } finally {
        if (active) {
          setPageLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
      stopCamera({ silent: true });
    };
  }, []);

  async function submitCheckIn(scanData) {
    setBusyState("checkin");
    setBanner("Checking in guest...", "info");

    try {
      const payload = await apiRequest("/api/check-in/scan", {
        method: "POST",
        body: { scanData },
        auth: false,
      });

      setScanResult(payload);
      setManualValue("");
      setBanner(
        payload.alreadyCheckedIn
          ? `${payload.guest.name} was already checked in.`
          : `${payload.guest.name} checked in successfully.`,
        "success",
      );
      await loadStaffData();
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      setBusyState("");
    }
  }

  async function scanLoop(video) {
    if (!detectorRef.current || !streamRef.current) {
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(video);
      const match = barcodes.find((barcode) => barcode.rawValue);

      if (match) {
        stopCamera({ silent: true });
        await submitCheckIn(match.rawValue);
        return;
      }
    } catch (_error) {}

    timerRef.current = window.setTimeout(() => scanLoop(video), 400);
  }

  async function handleStartCamera() {
    if (cameraActive) {
      stopCamera();
      return;
    }

    if (!("BarcodeDetector" in window)) {
      setBanner(
        "This browser does not expose BarcodeDetector. Use image upload or fallback entry instead.",
        "warn",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setBanner("This browser cannot access the camera. Use image upload or fallback entry instead.", "warn");
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setBanner("Camera ready. Hold the attendee QR inside the frame.", "info");
      scanLoop(videoRef.current);
    } catch (error) {
      stopCamera({ silent: true });
      setBanner(error.message, "error");
    }
  }

  async function handleImageScan(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    if (!("BarcodeDetector" in window)) {
      setBanner("Image scanning is not supported in this browser.", "warn");
      event.currentTarget.value = "";
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      const image = await createImageBitmap(file);
      const barcodes = await detectorRef.current.detect(image);
      const match = barcodes.find((barcode) => barcode.rawValue);

      if (!match) {
        throw new Error("No QR code was detected in that image.");
      }

      await submitCheckIn(match.rawValue);
    } catch (error) {
      setBanner(error.message, "error");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    const value = manualValue.trim();

    if (!value) {
      setBanner("Paste a QR payload or fallback code first.", "warn");
      return;
    }

    await submitCheckIn(value);
  }

  function handleLogout() {
    window.localStorage.removeItem(authStorageKey);
    setBanner("Local session data cleared.", "info");
  }

  const recentGuests = [...guests]
    .filter((guest) => guest.checkedInAt)
    .sort((left, right) => new Date(right.checkedInAt) - new Date(left.checkedInAt))
    .slice(0, 12);

  if (pageLoading && !dashboard) {
    return html`
      <div className="min-h-screen bg-shell">
        <${Sidebar} active="scanner" onLogout=${handleLogout} />
        <div className="min-h-screen lg:pl-72">
          <${Topbar}
            searchValue=${searchValue}
            onSearchChange=${setSearchValue}
            searchPlaceholder="Search recent scans..."
          />
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <${LoadingPanel} label="Loading scanner..." />
          </main>
        </div>
      </div>
    `;
  }

  return html`
    <div className="min-h-screen bg-shell">
      <${Sidebar} active="scanner" onLogout=${handleLogout} />

      <div className="min-h-screen lg:pl-72">
        <${Topbar}
          searchValue=${searchValue}
          onSearchChange=${setSearchValue}
          searchPlaceholder="Search recent scans..."
        />

        <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <${PageHeader}
            eyebrow="Staff Scanner"
            title=${`Scan guests into ${dashboard?.event?.name || "Badge Pop"}`}
            description="Use the attendee QR from their email, upload a QR image, or paste the fallback code. A successful scan immediately triggers the claim email."
            actions=${html`
              <button
                type="button"
                onClick=${handleStartCamera}
                className=${primaryButtonClass}
              >
                ${cameraActive ? "Stop camera scanner" : "Start camera scanner"}
              </button>
              <a href="/" className=${secondaryButtonClass}>Back to dashboard</a>
            `}
            meta=${[
              html`<${MetaCard} label="Event ID" value=${dashboard?.event?.id || "Unavailable"} mono=${true} />`,
              html`<${MetaCard} label="Delivery Mode" value=${dashboard?.platform?.deliveryMode || "Preview"} />`,
              html`<${MetaCard}
                label="Blockchain Claims"
                value=${dashboard?.platform?.chainConfigured ? "Enabled" : "Waiting for config"}
              />`,
            ]}
          />

          ${notice ? html`<div className="mt-6"><${NoticeBanner} message=${notice.message} tone=${notice.tone} /></div>` : null}

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
            <${PanelCard}
              eyebrow="Live"
              title="Camera scanner"
              description="Point the camera at the attendee QR or upload an image capture from their inbox."
              actions=${html`
                <button
                  type="button"
                  className=${secondaryButtonClass}
                  onClick=${() => fileInputRef.current?.click()}
                >
                  Scan from image
                </button>
              `}
            >
              <div className="rounded-xl border border-dashed border-border bg-slate-50/70 p-4">
                <div className="relative overflow-hidden rounded-xl border border-border bg-white">
                  <video
                    ref=${videoRef}
                    className=${cx("h-[360px] w-full object-cover", cameraActive ? "block" : "hidden")}
                    playsInline=${true}
                    muted=${true}
                  ></video>
                  ${!cameraActive
                    ? html`
                        <div className="flex h-[360px] items-center justify-center px-6">
                          <${EmptyState}
                            compact=${true}
                            icon=${html`<${CameraIcon} className="h-6 w-6" />`}
                            title="Camera idle"
                            description="Start the scanner or upload a QR image captured from an attendee email."
                          />
                        </div>
                      `
                    : null}
                </div>
              </div>
              <input
                ref=${fileInputRef}
                type="file"
                accept="image/*"
                hidden=${true}
                onChange=${handleImageScan}
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <${StatusBadge} tone=${cameraActive ? "accent" : "neutral"}>
                  ${cameraActive ? "Scanner live" : "Scanner idle"}
                </${StatusBadge}>
                <p className="text-sm text-navy-500">
                  ${cameraActive
                    ? "Hold the QR steady until it is decoded."
                    : "Fallback entry stays available if camera access is blocked."}
                </p>
              </div>
            </${PanelCard}>

            <div className="space-y-6">
              <${PanelCard}
                eyebrow="Fallback"
                title="Manual entry"
                description="Paste a raw QR payload or type the fallback code printed under the attendee QR."
              >
                <form className="space-y-4" onSubmit=${handleManualSubmit}>
                  <${Field} label="Scan payload or fallback code" htmlFor="manualCheckInValue">
                    <input
                      id="manualCheckInValue"
                      className=${cx(inputClass, "font-mono")}
                      placeholder="badgepop://check-in/... or BP-XXXXXX"
                      value=${manualValue}
                      onInput=${(event) => {
                        const value = event.currentTarget.value;
                        setManualValue(value);
                      }}
                    />
                  </${Field}>
                  <button
                    type="submit"
                    disabled=${busyState === "checkin"}
                    className=${cx(primaryButtonClass, "w-full")}
                  >
                    ${busyState === "checkin" ? "Checking in..." : "Check in guest"}
                  </button>
                </form>
              </${PanelCard}>

              <${ScanResultCard} result=${scanResult} />
            </div>
          </section>

          <section className="mt-6">
            <${RecentActivityCard} guests=${recentGuests} query=${deferredSearch} />
          </section>
        </main>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${StaffApp} />`);
