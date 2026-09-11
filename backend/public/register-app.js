import {
  Field,
  MetaCard,
  NoticeBanner,
  PageHeader,
  SectionHeader,
  Sidebar,
  Topbar,
  apiRequest,
  createRoot,
  cx,
  html,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellCardClass,
  useState,
} from "./saas-ui.js";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = await apiRequest("/api/guests/self-register", {
        method: "POST",
        body: { name, email },
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return html`
    <div className="min-h-screen bg-shell">
      <${Sidebar} active="register" />
      <div className="min-h-screen lg:pl-72">
        <${Topbar} searchPlaceholder="Search token..." />
        <main className="space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <${PageHeader}
            eyebrow="Public Registration"
            title="Register for Badge Pop"
            description="Skip Luma and the Chrome extension - register directly to test the full check-in, claim, and mint flow yourself."
          />

          ${error ? html`<${NoticeBanner} tone="error" message=${error} />` : null}

          ${!result
            ? html`
                <section className=${shellCardClass}>
                  <${SectionHeader}
                    eyebrow="Step 1"
                    title="Your details"
                    description="We'll email you a QR check-in pass (or show it here if email isn't reachable)."
                  />
                  <form onSubmit=${handleSubmit} className="space-y-5 px-5 py-5">
                    <${Field} label="Full name" htmlFor="name">
                      <input
                        id="name"
                        type="text"
                        required
                        value=${name}
                        onInput=${(e) => setName(e.currentTarget.value)}
                        className=${inputClass}
                        placeholder="Jane Doe"
                      />
                    </${Field}>
                    <${Field} label="Email" htmlFor="email">
                      <input
                        id="email"
                        type="email"
                        required
                        value=${email}
                        onInput=${(e) => setEmail(e.currentTarget.value)}
                        className=${inputClass}
                        placeholder="jane@example.com"
                      />
                    </${Field}>
                    <button type="submit" disabled=${submitting} className=${primaryButtonClass}>
                      ${submitting ? "Registering..." : "Register"}
                    </button>
                  </form>
                </section>
              `
            : html`
                <section className=${shellCardClass}>
                  <${SectionHeader}
                    eyebrow="Step 2"
                    title="You're registered"
                    description=${result.emailSent
                      ? "A check-in email is on its way to your inbox."
                      : "Email delivery isn't configured on this deployment - use the fallback code below directly."}
                  />
                  <div className="space-y-5 px-5 py-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <${MetaCard} label="Fallback check-in code" value=${result.checkInCode} mono=${true} />
                      <${MetaCard} label="Guest" value="${result.guest.name} (${result.guest.email})" />
                    </div>
                    <p className="text-sm leading-6 text-navy-500">
                      Next: open the <strong>Event Scanner</strong> and enter this code manually to check yourself
                      in (in a real event, staff would scan your QR code instead). That triggers your badge-claim
                      email and unlocks minting.
                    </p>
                    <a href="/staff" className=${cx(primaryButtonClass, "no-underline")}>Go to Event Scanner</a>
                    <a href="/register" className=${cx(secondaryButtonClass, "ml-3 no-underline")}
                      >Register another guest</a
                    >
                  </div>
                </section>
              `}
        </main>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${RegisterPage} />`);
