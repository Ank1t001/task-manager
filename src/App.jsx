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
  const [error, setError] = useState("");

  const organization = import.meta.env.VITE_AUTH0_ORG_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const signedInLabel = isLoading
    ? "Loading..."
    : isAuthenticated
    ? user?.email || user?.name || "Signed in"
    : "Not signed in";

  const taskCount = tasks.length;

  const btnGhost = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  };

  const btnPrimary = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#111827",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  };

  const pill = {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(17,24,39,0.06)",
    fontWeight: 700,
    color: "#111827",
  };

  const errorBox = {
    marginTop: 14,
    background: "#fff1f1",
    border: "1px solid #ffc7c7",
    color: "#7a2f2f",
    padding: 14,
    borderRadius: 12,
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };

  // ---- Fetch tasks after login ----
  useEffect(() => {
    const load = async () => {
      setError("");

      if (!isAuthenticated) {
        setTasks([]);
        return;
      }

      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience,
            organization, // ✅ ensures token is scoped to org
          },
        });

        const res = await fetch("/api/tasks", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} :: ${text}`);
        }

        const data = await res.json();
        setTasks(Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data) ? data : []);
      } catch (e) {
        setTasks([]);
        setError(String(e?.message || e));
      }
    };

    load();
  }, [isAuthenticated, getAccessTokenSilently, audience, organization]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, overdue, inProgress, done };
  }, [tasks]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 28,
        background: "linear-gradient(180deg, #f6f7fb 0%, #eef1f7 100%)",
      }}
    >
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
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
                type="button" // ✅ prevents page refresh submit behavior
                style={btnPrimary}
                disabled={isLoading}
                onClick={async () => {
                  await loginWithRedirect({
                    authorizationParams: {
                      organization: import.meta.env.VITE_AUTH0_ORG_ID,
                      audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                      redirect_uri:
                        import.meta.env.VITE_AUTH0_REDIRECT_URI ||
                        window.location.origin,
                    },
                  });
                }}
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
              If you see <code>401</code>, token/cookie isn’t present. If you see
              <code> 403</code> with tenant/org message, membership isn’t mapped yet.
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <StatCard title="Total Tasks" value={stats.total} />
          <StatCard title="Overdue" value={stats.overdue} />
          <StatCard title="In Progress" value={stats.inProgress} />
          <StatCard title="Done" value={stats.done} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Tasks</div>
          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                background: "rgba(17,24,39,0.03)",
                padding: 12,
                fontWeight: 800,
                color: "#445066",
                fontSize: 13,
              }}
            >
              <div>Task</div>
              <div>Owner</div>
              <div>Priority</div>
              <div>Status</div>
              <div>Due</div>
              <div>Project</div>
              <div>Stage</div>
            </div>

            {tasks.length === 0 ? (
              <div style={{ padding: 16, color: "#6b7280" }}>
                {isAuthenticated ? "No tasks found for your tenant." : "Login to load tasks."}
              </div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: 12,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{t.title || t.task || "-"}</div>
                  <div>{t.owner || "-"}</div>
                  <div>{t.priority || "-"}</div>
                  <div>{t.status || "-"}</div>
                  <div>{t.due || "-"}</div>
                  <div>{t.project || "-"}</div>
                  <div>{t.stage || "-"}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            style={btnGhost}
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  const box = {
    flex: 1,
    borderRadius: 16,
    border: "2px solid rgba(17,24,39,0.08)",
    padding: 14,
    background: "white",
    minHeight: 84,
  };

  const h = { fontWeight: 900, color: "#111827" };
  const v = { fontSize: 30, fontWeight: 900, marginTop: 6, color: "#111827", opacity: 0.2 };

  return (
    <div style={box}>
      <div style={h}>{title}</div>
      <div style={v}>{value}</div>
    </div>
  );
}