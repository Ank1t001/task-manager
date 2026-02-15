import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function App() {
  // --- UI/theme (default LIGHT as you requested)
  const [darkMode, setDarkMode] = useState(false);

  // --- Auth0
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [apiError, setApiError] = useState("");
  const [tasks, setTasks] = useState([]);

  const displayName =
    user?.name || user?.nickname || user?.email || "Not signed in";

  const authDebug = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      user: user ? { email: user.email, name: user.name, sub: user.sub } : null,
    }),
    [isLoading, isAuthenticated, user]
  );

  async function getToken() {
    // Always request for the configured API audience
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    return await getAccessTokenSilently({
      authorizationParams: { audience },
    });
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    if (isAuthenticated) {
      const token = await getToken();
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg =
        typeof data === "string"
          ? data
          : data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadTasks() {
    setApiError("");
    try {
      const data = await apiFetch("/api/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setTasks([]);
      setApiError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadTasks();
    } else {
      setTasks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const onLogin = async () => {
    // Prevent “button refresh” behavior
    await loginWithRedirect({
      authorizationParams: {
        redirect_uri:
          import.meta.env.VITE_AUTH0_REDIRECT_URI?.trim() ||
          window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
  };

  const onLogout = () => {
    logout({
      logoutParams: {
        returnTo:
          import.meta.env.VITE_AUTH0_REDIRECT_URI?.trim() ||
          window.location.origin,
      },
    });
  };

  return (
    <div className={darkMode ? "dtt-root dtt-dark" : "dtt-root dtt-light"}>
      <div className="dtt-shell">
        <header className="dtt-header">
          <div>
            <h1 className="dtt-title">Digital Team Task Tracker</h1>
            <div className="dtt-subtitle">
              Signed in: {displayName} • v13.1-auth0
            </div>
          </div>

          <div className="dtt-actions">
            <button
              type="button"
              className="dtt-btn"
              onClick={() => setDarkMode((v) => !v)}
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            {!isAuthenticated ? (
              <button type="button" className="dtt-btn dtt-btn-primary" onClick={onLogin}>
                Login
              </button>
            ) : (
              <button type="button" className="dtt-btn" onClick={onLogout}>
                Logout
              </button>
            )}

            <div className="dtt-pill">{tasks.length} tasks</div>
          </div>
        </header>

        {/* Auth debug (REMOVE later) */}
        <div className="dtt-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Auth Debug</div>
          <pre style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
            {JSON.stringify(authDebug, null, 2)}
          </pre>
        </div>

        {apiError ? (
          <div className="dtt-error" style={{ marginTop: 12 }}>
            Tasks API Error: {apiError}
          </div>
        ) : null}

        {/* Minimal tasks output for now (so you can confirm auth+API works) */}
        <div className="dtt-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Tasks</div>
          {!isAuthenticated ? (
            <div style={{ opacity: 0.75 }}>Login to load tasks.</div>
          ) : tasks.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No tasks found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {tasks.map((t) => (
                <div key={t.id} className="dtt-row">
                  <div style={{ fontWeight: 800 }}>{t.taskName}</div>
                  <div style={{ opacity: 0.8 }}>{t.description || "—"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {t.owner} • {t.status} • {t.priority} • {t.dueDate || "No due date"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}