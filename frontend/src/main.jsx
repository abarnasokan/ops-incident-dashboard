import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STATUSES = ["Open", "In Progress", "Mitigated", "Resolved"];
const TRANSITIONS = {
  Open: ["In Progress", "Resolved"],
  "In Progress": ["Open", "Mitigated", "Resolved"],
  Mitigated: ["In Progress", "Resolved"],
  Resolved: ["Open"],
};
const SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"];
const date = (value) => new Date(value).toLocaleString();
const label = (incident) => `INC-${String(incident.id).padStart(4, "0")}`;
const initials = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
function Badge({ value }) {
  return (
    <span className={`badge ${value.toLowerCase().replaceAll(" ", "-")}`}>
      {value}
    </span>
  );
}
async function request(path, token, body, method = "POST") {
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok && !data.captured) {
    const error = new Error(
      data.errors?.map((e) => `${e.field}: ${e.message}`).join(" · ") ||
        data.message ||
        "Request failed",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function Login({ onLogin }) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    email: "alex@example.com",
    password: "demo-password",
  });
  const update = (e) =>
    setFields({ ...fields, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await request(
          register ? "/auth/register" : "/auth/login",
          null,
          fields,
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">◈</span> Ops / Incident
        </div>
        <div className="login-copy">
          <span className="eyebrow">BUILT FOR THE ON-CALL MOMENT</span>
          <h1>
            Less context switching.
            <br />
            More clarity.
          </h1>
          <p>
            One workspace for your incident queue, response history, and
            evidence-based triage.
          </p>
          <div className="story-line">
            <span>01</span>
            <div>
              <strong>Track the response</strong>
              <p>Ownership, severity, and status in one place.</p>
            </div>
          </div>
          <div className="story-line">
            <span>02</span>
            <div>
              <strong>Keep the context</strong>
              <p>Comments and changes form a durable timeline.</p>
            </div>
          </div>
          <div className="story-line">
            <span>03</span>
            <div>
              <strong>Investigate with evidence</strong>
              <p>Capture a lab failure and review its telemetry.</p>
            </div>
          </div>
        </div>
        <small>Local portfolio demo · Synthetic incident data</small>
      </section>
      <section className="login-form">
        <div className="login-box">
          <span className="eyebrow">YOUR OPERATIONS WORKSPACE</span>
          <h2>{register ? "Create your account" : "Welcome back."}</h2>
          <p>
            {register
              ? "Join the shared local incident workspace."
              : "Sign in to explore the incident response demo."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Name
                <input
                  name="name"
                  value={fields.name}
                  onChange={update}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                value={fields.email}
                onChange={update}
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                value={fields.password}
                onChange={update}
                required
                minLength={10}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Connecting…" : register ? "Create account" : "Sign in"}
            </button>
          </form>
          <div className="demo-note">
            <strong>Demo account</strong>
            <br />
            alex@example.com / demo-password
            <br />
            <small>Seed the demo database before signing in.</small>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already have an account? Sign in"
              : "Create a local account"}
          </button>
        </div>
      </section>
    </div>
  );
}
function Dialog({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function IncidentForm({ incident, users, onSave, onClose }) {
  const [fields, setFields] = useState({
    title: incident?.title || "",
    description: incident?.description || "",
    service: incident?.service || "",
    severity: incident?.severity || "SEV3",
    category: incident?.category || "Application",
    assigned_to: incident?.assigned_to || "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (e) =>
    setFields({ ...fields, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        ...fields,
        assigned_to: fields.assigned_to ? Number(fields.assigned_to) : null,
        ...(incident ? { version: incident.version } : {}),
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={incident ? "Edit incident" : "Create an incident"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="incident-form">
        <label>
          Title
          <input
            autoFocus
            name="title"
            value={fields.title}
            onChange={update}
            required
            maxLength={160}
            placeholder="What is happening?"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            value={fields.description}
            onChange={update}
            required
            maxLength={10000}
            rows={4}
            placeholder="Impact, observations, and context"
          />
        </label>
        <div className="form-grid">
          <label>
            Service
            <input
              name="service"
              value={fields.service}
              onChange={update}
              required
              maxLength={80}
              placeholder="e.g. Payments"
            />
          </label>
          <label>
            Severity
            <select
              aria-label="Severity"
              name="severity"
              value={fields.severity}
              onChange={update}
            >
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              name="category"
              value={fields.category}
              onChange={update}
            >
              {[
                "Application",
                "Infrastructure",
                "Database",
                "Network",
                "Security",
                ...(![
                  "Application",
                  "Infrastructure",
                  "Database",
                  "Network",
                  "Security",
                ].includes(fields.category)
                  ? [fields.category]
                  : []),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Owner
            <select
              name="assigned_to"
              aria-label="Owner"
              value={fields.assigned_to}
              onChange={update}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : incident ? "Save changes" : "Create incident"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function Detail({
  incident,
  users,
  config,
  busy,
  onUpdate,
  onComment,
  onTriage,
  onFailure,
  onEdit,
  report,
}) {
  const [comment, setComment] = useState(""),
    [nextStatus, setNextStatus] = useState(incident.status);
  useEffect(() => {
    setNextStatus(incident.status);
    setComment("");
  }, [incident.id, incident.status]);
  async function add(e) {
    e.preventDefault();
    if (await onComment(comment)) setComment("");
  }
  return (
    <aside className="detail-panel" aria-label="Incident details">
      <div className="detail-top">
        <span>{label(incident)}</span>
        <button className="text-button" onClick={onEdit}>
          Edit details ↗
        </button>
      </div>
      <h2>{incident.title}</h2>
      <div className="detail-badges">
        <Badge value={incident.severity} />
        <Badge value={incident.status} />
      </div>
      <p className="description">{incident.description}</p>
      <div className="metadata">
        <div>
          <span>SERVICE</span>
          <strong>{incident.service}</strong>
        </div>
        <div>
          <span>CREATED</span>
          <strong>{date(incident.created_at)}</strong>
        </div>
      </div>
      <label className="control-label">
        Assigned owner
        <select
          aria-label="Assigned owner"
          disabled={busy}
          value={incident.assigned_to || ""}
          onChange={(e) =>
            onUpdate({
              assigned_to: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="status-change">
        <label className="control-label">
          Response status
          <select
            aria-label="Response status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
          >
            <option>{incident.status}</option>
            {TRANSITIONS[incident.status].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={busy || nextStatus === incident.status}
          onClick={() => onUpdate({ status: nextStatus })}
        >
          Update status
        </button>
      </div>
      <section className="triage-section">
        <div className="section-heading">
          <h3>Evidence-based triage</h3>
          <span className="tiny-pill">HUMAN REVIEW</span>
        </div>
        <p>
          Capture real lab telemetry, then review a first hypothesis. No
          remediation is performed.
        </p>
        {config.lab_failures && (
          <div className="lab-controls">
            <button
              disabled={busy}
              onClick={() => onFailure("http_error")}
              className="secondary"
            >
              Capture HTTP failure
            </button>
            <button
              disabled={busy}
              onClick={() => onFailure("slow_query")}
              className="secondary"
            >
              Capture slow query
            </button>
          </div>
        )}
        <div className="triage-actions">
          <button
            disabled={busy}
            className="primary"
            onClick={() => onTriage("rules")}
          >
            Generate rule-based summary
          </button>
          {config.claude_configured && (
            <button
              disabled={busy}
              className="secondary"
              onClick={() => onTriage("claude")}
            >
              Send lab evidence to Claude
            </button>
          )}
        </div>
        {config.claude_configured && (
          <p className="fine-print">
            The Claude action sends this incident’s captured lab events to
            Anthropic.
          </p>
        )}
        {report && (
          <div className="triage-report">
            <span className="tiny-pill">
              {report.provider === "claude"
                ? "CLAUDE HYPOTHESIS"
                : "RULE-BASED SUMMARY"}
            </span>
            <h4>{report.hypothesis}</h4>
            <p>{report.summary}</p>
            <ul>
              {report.next_steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <small>
              Confidence: {report.confidence} · Evidence:{" "}
              {report.evidence_ids.length
                ? report.evidence_ids.map((id) => `#${id}`).join(", ")
                : "none"}
            </small>
          </div>
        )}
        <div className="telemetry-list">
          {incident.telemetry.map((e) => (
            <div className="evidence-row" key={e.id}>
              <strong>
                Evidence #{e.id} · {e.kind.replaceAll("_", " ")}
              </strong>
              <p>{e.message}</p>
              <small>
                {Number(e.duration_ms).toFixed(1)} ms · {date(e.created_at)}
              </small>
              {e.trace_id && (
                <a
                  href={`http://127.0.0.1:16686/trace/${e.trace_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View trace in Jaeger ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="comments-section">
        <h3>Response notes</h3>
        {incident.comments.length === 0 && (
          <p className="muted">No notes yet. Record what you’ve checked.</p>
        )}
        {incident.comments.map((c) => (
          <div className="comment" key={c.id}>
            <strong>{c.author_name}</strong>
            <small>{date(c.created_at)}</small>
            <p>{c.body}</p>
          </div>
        ))}
        <form onSubmit={add}>
          <label className="sr-only" htmlFor="comment">
            Response note
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={4000}
            placeholder="Add findings or a handoff note…"
            rows={3}
            required
          />
          <button className="secondary" disabled={busy || !comment.trim()}>
            Add note
          </button>
        </form>
      </section>
      <section className="activity-section">
        <h3>Activity timeline</h3>
        {incident.activity.map((e) => (
          <div className="activity-row" key={e.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{e.actor_name}</strong>{" "}
              {e.kind === "created"
                ? "created this incident"
                : e.kind === "updated"
                  ? "updated " + Object.keys(e.details).join(", ")
                  : e.kind === "commented"
                    ? "added a response note"
                    : e.kind === "triage_generated"
                      ? "generated a triage report"
                      : "archived this incident"}
              <small>{date(e.created_at)}</small>
              {e.details.status && (
                <p>
                  {e.details.status.from} → {e.details.status.to}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}
function Dashboard({ session, onLogout }) {
  const [queue, setQueue] = useState({ items: [], total: 0, page: 1 }),
    [metrics, setMetrics] = useState(null),
    [users, setUsers] = useState([]),
    [config, setConfig] = useState({});
  const [selected, setSelected] = useState(null),
    [filters, setFilters] = useState({
      q: "",
      status: "",
      severity: "",
      page: 1,
    }),
    [modal, setModal] = useState(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState(null);
  const selectedRef = useRef(null),
    loadGeneration = useRef(0);
  const api = (path, body, method) =>
    request(path, session.token, body, method);
  async function reload(id = selectedRef.current) {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "")),
      );
      const [list, stats, team, settings] = await Promise.all([
        api("/incidents?" + params),
        api("/metrics"),
        api("/users"),
        api("/config"),
      ]);
      if (generation !== loadGeneration.current) return;
      setQueue(list);
      setMetrics(stats);
      setUsers(team);
      setConfig(settings);
      const target = id || list.items[0]?.id;
      if (target) {
        const detail = await api("/incidents/" + target);
        if (generation === loadGeneration.current) {
          setSelected(detail);
          selectedRef.current = target;
        }
      } else {
        setSelected(null);
        selectedRef.current = null;
      }
    } catch (e) {
      if (generation === loadGeneration.current) {
        setError(e.message);
        if (e.status === 401) onLogout();
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => reload(), 180);
    return () => clearTimeout(timer);
  }, [filters]);
  async function choose(id) {
    setReport(null);
    setError("");
    selectedRef.current = id;
    await reload(id);
  }
  async function action(fn, message) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      await reload();
      return true;
    } catch (e) {
      setError(e.message);
      if (e.status === 409) await reload();
      if (e.status === 401) onLogout();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const update = (patch) =>
    action(async () => {
      await api(
        "/incidents/" + selected.id,
        { ...patch, version: selected.version },
        "PATCH",
      );
      setReport(null);
    }, "Incident updated.");
  async function save(fields) {
    const row = await api(
      modal === "edit" ? "/incidents/" + selected.id : "/incidents",
      fields,
      modal === "edit" ? "PATCH" : "POST",
    );
    selectedRef.current = row.id;
    setReport(null);
    setNotice(
      modal === "edit" ? "Incident details saved." : "Incident created.",
    );
    await reload(row.id);
  }
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-icon">◈</span> Ops / Incident
        </div>
        <div className="nav-caption">OPERATIONS</div>
        <a href="#workspace" className="nav-link active">
          ◈ <span>Incident workspace</span>
        </a>
        <a
          href="https://github.com/abarnasokan/ops-incident-dashboard"
          target="_blank"
          rel="noreferrer"
          className="nav-link"
        >
          ↗ <span>Project & documentation</span>
        </a>
        <div className="sidebar-bottom">
          <span className="live-dot" /> Local portfolio demo
          <br />
          <small>One team. A clear response.</small>
        </div>
      </nav>
      <main id="workspace">
        <header>
          <span className="breadcrumb">WORKSPACE / INCIDENT RESPONSE</span>
          <div className="account">
            <span className="avatar">{initials(session.user.name)}</span>
            <span>{session.user.name}</span>
            <button className="text-button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR ON-CALL COMMAND CENTER</span>
            <h1>Keep the response moving.</h1>
            <p>
              Prioritize the queue, share context, and investigate with
              evidence.
            </p>
          </div>
          <button className="primary" onClick={() => setModal("create")}>
            + Create incident
          </button>
        </div>
        <div className="demo-banner">
          <span>◈</span> Local demo · Seeded incidents are synthetic. Lab
          failure events are captured from real API requests.
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success" role="status">
            {notice}
          </div>
        )}
        <section className="stats" aria-label="Incident metrics">
          <article>
            <span>ACTIVE INCIDENTS</span>
            <strong>{metrics?.active ?? "—"}</strong>
            <small>Open, investigating, or mitigated</small>
          </article>
          <article>
            <span>CRITICAL / SEV1</span>
            <strong className="critical-number">
              {metrics?.critical ?? "—"}
            </strong>
            <small>Active incidents needing attention</small>
          </article>
          <article>
            <span>UNASSIGNED</span>
            <strong>{metrics?.unassigned ?? "—"}</strong>
            <small>Active incidents without an owner</small>
          </article>
          <article>
            <span>MEAN RESOLUTION</span>
            <strong>
              {metrics?.mean_resolution_minutes
                ? `${metrics.mean_resolution_minutes}m`
                : "—"}
            </strong>
            <small>Resolved incidents · includes demo data</small>
          </article>
        </section>
        <div className="workspace">
          <section className="queue-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Incident queue <span className="count">{queue.total}</span>
                </h2>
                <p>Severity first. Context always.</p>
              </div>
              <button
                disabled={loading || busy}
                className="text-button"
                onClick={() => reload()}
              >
                ↻ Refresh
              </button>
            </div>
            <div className="filters">
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="Search incidents"
                  placeholder="Search title or service…"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value, page: 1 })
                  }
                />
              </label>
              <select
                aria-label="Filter status"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value, page: 1 })
                }
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter severity"
                value={filters.severity}
                onChange={(e) =>
                  setFilters({ ...filters, severity: e.target.value, page: 1 })
                }
              >
                <option value="">All severities</option>
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="queue-list" aria-busy={loading}>
              {loading && queue.items.length === 0 ? (
                <div className="empty">Loading your workspace…</div>
              ) : queue.items.length === 0 ? (
                <div className="empty">
                  <h3>No matching incidents.</h3>
                  <p>Clear the filters or create an incident to begin.</p>
                </div>
              ) : (
                queue.items.map((i) => (
                  <button
                    key={i.id}
                    className={`incident-row ${selected?.id === i.id ? "selected" : ""}`}
                    onClick={() => choose(i.id)}
                  >
                    <div className="row-top">
                      <span>{label(i)}</span>
                      <Badge value={i.severity} />
                    </div>
                    <strong>{i.title}</strong>
                    <div className="row-meta">
                      <span>{i.service}</span>
                      <Badge value={i.status} />
                    </div>
                    <div className="row-bottom">
                      <span>{i.assigned_name || "Unassigned"}</span>
                      <span>{date(i.created_at)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="pagination">
              <span>
                {queue.total} matching incidents · page {filters.page}
              </span>
              <button
                className="secondary"
                disabled={filters.page <= 1 || loading}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                Previous
              </button>
              <button
                className="secondary"
                disabled={filters.page * 20 >= queue.total || loading}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </button>
            </div>
          </section>
          {selected ? (
            <Detail
              key={selected.id}
              incident={selected}
              users={users}
              config={config}
              busy={busy || loading}
              onUpdate={update}
              onComment={(body) =>
                action(
                  () =>
                    api("/incidents/" + selected.id + "/comments", { body }),
                  "Response note added.",
                )
              }
              onEdit={() => setModal("edit")}
              report={report}
              onTriage={(provider) =>
                action(
                  async () =>
                    setReport(
                      await api("/incidents/" + selected.id + "/summary", {
                        provider,
                      }),
                    ),
                  "Triage report ready for review.",
                )
              }
              onFailure={(scenario) =>
                action(async () => {
                  await api("/incidents/" + selected.id + "/lab-failure", {
                    scenario,
                  });
                  setReport(null);
                }, "Real lab telemetry captured. The deliberate failure is expected.")
              }
            />
          ) : (
            <section className="detail-panel empty">
              <h2>Your investigation starts here.</h2>
              <p>
                Select an incident or create one to see its response history.
              </p>
            </section>
          )}
        </div>
        <footer>
          Ops Incident Dashboard · Built for evidence and accountable incident
          response.
        </footer>
      </main>
      {modal && (
        <IncidentForm
          incident={modal === "edit" ? selected : null}
          users={users}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
function App() {
  const [session, setSession] = useState(null);
  return session ? (
    <Dashboard session={session} onLogout={() => setSession(null)} />
  ) : (
    <Login onLogin={setSession} />
  );
}
createRoot(document.getElementById("root")).render(<App />);
