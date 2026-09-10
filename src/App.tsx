import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
type Role = "EMPLOYEE" | "HR_MEMBER" | "SYSTEM_ADMIN";
type User = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  enabled: boolean;
};
type ApiUser = Omit<User, "displayName"> & { display_name: string };
type AuthResponse = {
  token: string;
  username: string;
  displayName: string;
  role: Role;
};
type ApiAuthResponse = Omit<AuthResponse, "displayName"> & {
  display_name: string;
};

function mapUser(user: ApiUser): User {
  return {
    ...user,
    displayName: user.display_name,
  };
}

function mapAuthResponse(response: ApiAuthResponse): AuthResponse {
  return {
    ...response,
    displayName: response.display_name,
  };
}
const navItems = [
  { label: "Overview" },
  { label: "Users" },
  { label: "HR members" },
  { label: "Surveys" },
  { label: "Reports" },
];

function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => {
    // Keep the access token in memory so a browser refresh ends the local admin session.
    return null;
  });
  const [activePage, setActivePage] = useState("Overview");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  useEffect(() => {
    if (session) void loadUsers(session.token);
  }, [session]);
  async function loadUsers(token: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not load users");
      const data = (await response.json()) as ApiUser[];
      setUsers(data.map(mapUser));
      setApiConnected(true);
    } catch {
      setApiConnected(false);
      setError(
        "The backend is not responding. Check that it is running on port 8080.",
      );
    } finally {
      setLoading(false);
    }
  }
  function login(auth: AuthResponse) {
    setSession(auth);
  }
  function logout() {
    setSession(null);
    setUsers([]);
    setApiConnected(false);
  }
  if (!session) return <LoginScreen onLogin={login} />;
  const employees = users.filter((user) => user.role === "EMPLOYEE").length;
  const hrMembers = users.filter((user) => user.role === "HR_MEMBER").length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span>AD</span>
          <div>
            <strong>Admin</strong>
          </div>
        </div>
        <div className="workspace-label">Workspace</div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={`nav-item ${activePage === item.label ? "active" : ""}`}
              key={item.label}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-icon" aria-hidden="true" />
              {item.label}
              {item.label === "Users" && (
                <span className="nav-count">{users.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">SYSTEM ADMINISTRATION</span>
            <h1>{activePage}</h1>
          </div>
          <div className="topbar-actions">
            <span className="api-status">
              <i className={apiConnected ? "connected" : "disconnected"} />
              {apiConnected ? "API connected" : "API unavailable"}
            </span>
            <button className="avatar" aria-label="Open profile">
              AD
            </button>
          </div>
        </header>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => void loadUsers(session.token)}>Retry</button>
          </div>
        )}
        {activePage === "Overview" && (
          <Overview
            users={users}
            employees={employees}
            hrMembers={hrMembers}
            loading={loading}
            onUsers={() => setActivePage("Users")}
            onHr={() => setActivePage("HR members")}
          />
        )}
        {activePage === "Users" && (
          <UsersPage
            users={users}
            loading={loading}
            onRefresh={() => void loadUsers(session.token)}
          />
        )}
        {activePage === "HR members" && (
          <HrPage
            token={session.token}
            onCreated={() => void loadUsers(session.token)}
          />
        )}
        {!["Overview", "Users", "HR members"].includes(activePage) && (
          <ComingSoon title={activePage} />
        )}
      </main>
      <button className="logout-button" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (auth: AuthResponse) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Invalid credentials");
      if (data.role !== "SYSTEM_ADMIN")
        throw new Error("This console is restricted to system administrators");
      onLogin(mapAuthResponse(data as ApiAuthResponse));
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-aside">
        <div className="brand-mark light">
          <span>AD</span>
          <div>
            <strong>Admin</strong>
          </div>
        </div>
        <div className="login-message">
          <span className="eyebrow">CONTROL CENTER</span>
          <h1>Make workplace wellbeing visible.</h1>
          <p>
            A focused space for the people who care for the people behind the
            work.
          </p>
        </div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to the console</h2>
          <p className="form-intro">
            Use your system administrator credentials to continue.
          </p>
          <label>
            Username
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Signing in…" : "Enter console"}
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Overview({
  users,
  employees,
  hrMembers,
  loading,
  onUsers,
  onHr,
}: {
  users: User[];
  employees: number;
  hrMembers: number;
  loading: boolean;
  onUsers: () => void;
  onHr: () => void;
}) {
  const active = users.filter((user) => user.enabled).length;
  return (
    <section className="page-content">
      <div className="welcome-row">
        <div>
          <p className="kicker">SATURDAY, 29 AUGUST 2026</p>
          <h2>Good evening, Admin.</h2>
          <p className="muted">Here is the current pulse of your workspace.</p>
        </div>
        <button className="outline-button" onClick={onUsers}>
          View all users <span>→</span>
        </button>
      </div>
      <div className="metric-grid">
        <Metric
          label="Total accounts"
          value={loading ? "—" : users.length}
          note="Across the workspace"
        />
        <Metric
          label="Employees"
          value={loading ? "—" : employees}
          note="Registered workers"
          accent="coral"
        />
        <Metric
          label="HR members"
          value={loading ? "—" : hrMembers}
          note="Administrative access"
          accent="gold"
        />
        <Metric
          label="Active accounts"
          value={loading ? "—" : active}
          note="Currently enabled"
          accent="sage"
        />
      </div>
      <div className="content-grid">
        <div className="panel pulse-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ACCOUNT PULSE</span>
              <h3>Workspace overview</h3>
            </div>
            <span className="live-tag">
              <i /> Live
            </span>
          </div>
          <div className="pulse-visual">
            <div className="pulse-line">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="pulse-caption">
              <strong>{active} active accounts</strong>
              <span>Identity data is connected to MySQL</span>
            </div>
          </div>
        </div>
        <div className="panel quick-panel">
          <span className="eyebrow">QUICK ACTION</span>
          <h3>Grow your HR team.</h3>
          <p>Create a secure HR member account from the administration area.</p>
          <button className="dark-button" onClick={onHr}>
            Use HR members <span>＋</span>
          </button>
        </div>
      </div>
    </section>
  );
}
function Metric({
  label,
  value,
  note,
  accent = "blue",
}: {
  label: string;
  value: number | string;
  note: string;
  accent?: string;
}) {
  return (
    <div className={`metric metric-${accent}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}
function UsersPage({
  users,
  loading,
  onRefresh,
}: {
  users: User[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="page-content">
      <div className="section-title">
        <div>
          <span className="eyebrow">IDENTITY DIRECTORY</span>
          <h2>All users</h2>
          <p className="muted">
            Review accounts and access levels in this workspace.
          </p>
        </div>
        <button className="outline-button" onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <strong>{users.length} accounts</strong>
          <span>Sorted by creation date</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Loading accounts…
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-cell">
                        <span className="mini-avatar">
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </span>
                        <strong>{user.displayName}</strong>
                      </div>
                    </td>
                    <td className="mono">@{user.username}</td>
                    <td>
                      <span className={`role role-${user.role.toLowerCase()}`}>
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status ${user.enabled ? "enabled" : "disabled"}`}
                      >
                        <i />
                        {user.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="muted">{user.email}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
function HrPage({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/hr-members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          display_name: form.displayName,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? "Could not create HR member");
      setMessage(`HR member @${data.username} was created successfully.`);
      setForm({ username: "", email: "", displayName: "", password: "" });
      onCreated();
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Unable to create account",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="page-content">
      <div className="section-title">
        <div>
          <span className="eyebrow">ACCESS MANAGEMENT</span>
          <h2>HR members</h2>
          <p className="muted">
            Provision accounts for the people who manage wellbeing.
          </p>
        </div>
      </div>
      <div className="form-layout">
        <div className="panel create-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NEW ACCOUNT</span>
              <h3>Create an HR member</h3>
            </div>
          </div>
          <form onSubmit={submit} className="admin-form">
            <label>
              Display name
              <input
                required
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder="Ana Torres"
              />
            </label>
            <label>
              Username
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="ana.torres"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ana@company.com"
              />
            </label>
            <label>
              Temporary password
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </label>
            {message && <div className="success-message">{message}</div>}
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading}>
              {loading ? "Creating…" : "Create HR account"}
              <span>→</span>
            </button>
          </form>
        </div>
        <div className="note-block">
          <span className="eyebrow">PERMISSION NOTE</span>
          <h3>Keep access intentional.</h3>
          <p>
            HR members can later manage surveys, activities and reports. They
            cannot create system administrators.
          </p>
          <div className="rule" />
          <span className="muted">Role assigned automatically</span>
          <strong>HR_MEMBER</strong>
        </div>
      </div>
    </section>
  );
}
function ComingSoon({ title }: { title: string }) {
  return (
    <section className="page-content empty-page">
      <span className="eyebrow">MODULE IN PREPARATION</span>
      <h2>{title}</h2>
      <p className="muted">
        This module is reserved for the next backend domain implementation.
      </p>
    </section>
  );
}
export default App;
