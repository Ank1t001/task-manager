// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [tasks, setTasks] = useState([]);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const taskCount = tasks.length;

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const orgId = import.meta.env.VITE_AUTH0_ORG_ID;

  const apiFetch = async (path, opts = {}) => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience,
        ...(orgId ? { organization: orgId } : {}),
      },
    });

    const res = await fetch(path, {
      ...opts,
      headers: {
        "content-type": "application/json",
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} :: ${txt}`);
    }
    return res.json();
  };

  const loadAll = async () => {
    setError("");
    try {
      const [meRes, tasksRes] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/tasks"),
      ]);
      setMe(meRes);
      setTasks(tasksRes || []);
    } catch (e) {
      setError(String(e.message || e));
      setMe(null);
      setTasks([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadAll();
    else {
      setMe(null);
      setTasks([]);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const signedInLabel = useMemo(() => {
    if (isLoading) return "Loading…";
    if (!isAuthenticated) return "Not signed in";
    return me?.email || user?.email || "Signed in";
  }, [isLoading, isAuthenticated, me, user]);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", padding: 24 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "white",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
              Digital Team Task Tracker
            </div>
            <div style={{ marginTop: 6, color: "#546077" }}>
              Signed in: <b>{signedInLabel}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: {
                      ...(orgId ? { organization: orgId } : {}),
                    },
                  })
                }
                style={btnPrimary}
              >
                Login
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  logout({
                    logoutParams: {
                      returnTo:
                        import.meta.env.VITE_AUTH0_REDIRECT_URI ||
                        `${window.location.origin}/`,
                    },
                  })
                }
                style={btnGhost}
              >
                Logout
              </button>
            )}

            <div style={pill}>{taskCount} tasks</div>
          </div>
        </div>

        {error ? (
          <div style={errorBox}>
            <b>API Error:</b> {error}
            <div style={{ marginTop: 8, color: "#7a2f2f" }}>
              If you see <code>401</code>, token/cookie isn’t present. If you see <code>403</code>, tenant/org mapping isn’t set yet.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          {!isAuthenticated ? (
            <div style={{ padding: 18, borderRadius: 14, background: "#f7f9ff", border: "1px solid #e6ecff" }}>
              Login to load tasks.
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={tile("#6b7cff")}>
                  <div style={tileTitle}>Total Tasks</div>
                  <div style={tileNum}>{taskCount}</div>
                </div>
                <div style={tile("#ff6b6b")}>
                  <div style={tileTitle}>Overdue</div>
                  <div style={tileNum}>{tasks.filter((t) => t.status === "Overdue").length}</div>
                </div>
                <div style={tile("#ffb84d")}>
                  <div style={tileTitle}>In Progress</div>
                  <div style={tileNum}>{tasks.filter((t) => t.status === "In Progress").length}</div>
                </div>
                <div style={tile("#3ddc84")}>
                  <div style={tileTitle}>Done</div>
                  <div style={tileNum}>{tasks.filter((t) => t.status === "Done").length}</div>
                </div>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #eef1f7", borderRadius: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f7f9ff" }}>
                    <tr>
                      {["Task", "Owner", "Priority", "Status", "Due", "Project", "Stage"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            fontSize: 13,
                            color: "#546077",
                            borderBottom: "1px solid #eef1f7",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #f0f2f7" }}>
                        <td style={td}><b>{t.taskName}</b></td>
                        <td style={td}>{t.owner || "—"}</td>
                        <td style={td}>{t.priority || "—"}</td>
                        <td style={td}>{t.status || "—"}</td>
                        <td style={td}>{t.dueDate || "—"}</td>
                        <td style={td}>{t.projectName || "—"}</td>
                        <td style={td}>{t.stage || "—"}</td>
                      </tr>
                    ))}
                    {!tasks.length ? (
                      <tr>
                        <td style={{ padding: 16, color: "#7a859c" }} colSpan={7}>
                          No tasks found for your tenant.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button type="button" style={btnGhost} onClick={loadAll}>
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnPrimary = {
  border: "0",
  background: "#365cff",
  color: "white",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost = {
  border: "1px solid #dbe2f0",
  background: "white",
  color: "#182033",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const pill = {
  padding: "10px 14px",
  borderRadius: 999,
  background: "#f4f6fb",
  border: "1px solid #e6ebf7",
  fontWeight: 800,
};

const errorBox = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: "#fff3f3",
  border: "1px solid #ffd1d1",
  color: "#7a2f2f",
};

const tile = (borderColor) => ({
  flex: 1,
  padding: 16,
  borderRadius: 16,
  background: "linear-gradient(135deg, rgba(255,255,255,1), rgba(245,248,255,1))",
  border: `2px solid ${borderColor}`,
});

const tileTitle = { fontWeight: 800, color: "#2a3550", marginBottom: 6 };
const tileNum = { fontSize: 34, fontWeight: 900, color: "#111827" };
const td = { padding: "12px 14px", fontSize: 14 };