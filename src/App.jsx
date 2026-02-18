// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import TaskForm from "./components/TaskForm.jsx";
import TaskTable from "./components/TaskTable.jsx";
import StageEditor from "./components/StageEditor.jsx";
import ProjectView from "./components/ProjectView.jsx";
import Projects from "./components/Projects.jsx";
import Modal from "./components/Modal.jsx";
import MiniDashboard from "./components/MiniDashboard.jsx";
import KanbanBoard from "./components/KanbanBoard.jsx";

export default function App() {
  const {
    isAuthenticated,
    user,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [tasks, setTasks] = useState([]);
  const [apiError, setApiError] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [theme, setTheme] = useState("dark");

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const organization = import.meta.env.VITE_AUTH0_ORG_ID;
  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/`;

  const apiBase = useMemo(() => "/api", []);

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function getToken() {
    return await getAccessTokenSilently({
      authorizationParams: { audience, organization, scope: "openid profile email" },
    });
  }

  async function fetchJSON(path) {
    const token = await getToken();
    const res = await fetch(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error: ${res.status} :: ${contentType.includes("application/json") ? text : text.slice(0, 800)}`);
    }
    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  }

  async function loadTasks() {
    setApiError("");
    if (!isAuthenticated) { setTasks([]); return; }
    try {
      const data = await fetchJSON("/tasks");
      setTasks(data?.tasks || []);
    } catch (e) {
      setApiError(String(e?.message || e));
      setTasks([]);
    }
  }

  useEffect(() => {
    if (!isLoading) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  async function handleLogin() {
    await loginWithRedirect({
      authorizationParams: { audience, organization, redirect_uri: redirectUri, scope: "openid profile email" },
    });
  }

  function handleLogout() {
    logout({ logoutParams: { returnTo: window.location.origin } });
  }

  const userInitial = (user?.name || user?.email || "?")[0].toUpperCase();

  return (
    <div className="dtt-page">
      <div className="dtt-shell">

        {/* ── HEADER ── */}
        <header className="dtt-card" style={{ padding: "16px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #4d7cff 0%, #a855f7 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 4px 16px rgba(77,124,255,0.45)",
              }}>📋</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.3px", lineHeight: 1.15 }}>
                  Digital Team Task Tracker
                </div>
                {isAuthenticated && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                    {user?.email || user?.name}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="dtt-iconBtn"
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                style={{ fontSize: 16 }}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>

              {isAuthenticated && (
                <button className="dtt-btn" onClick={loadTasks}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px" }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>↻</span> Refresh
                </button>
              )}

              {!isAuthenticated ? (
                <button className="dtt-btnPrimary" onClick={handleLogin}
                  style={{ padding: "10px 20px", fontWeight: 900 }}>
                  Sign In
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 999,
                    background: "linear-gradient(135deg, #4d7cff, #a855f7)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0,
                  }}>
                    {userInitial}
                  </div>
                  <button className="dtt-btn" onClick={handleLogout} style={{ fontSize: 13 }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── ERROR ── */}
        {apiError && (
          <div style={{
            padding: "14px 18px", borderRadius: 14,
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.40)",
            color: "#fca5a5", fontSize: 13, whiteSpace: "pre-wrap",
          }}>
            ⚠️ {apiError}
          </div>
        )}

        {/* ── NOT AUTH ── */}
        {!isAuthenticated && !isLoading && (
          <div className="dtt-card" style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Welcome back</div>
            <div style={{ color: "var(--muted)", marginBottom: 28, fontSize: 14 }}>
              Sign in to access your team's tasks and projects.
            </div>
            <button className="dtt-btnPrimary" onClick={handleLogin}
              style={{ padding: "12px 32px", fontWeight: 900, fontSize: 15, borderRadius: 14 }}>
              Sign In
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {isLoading && (
          <div className="dtt-card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--muted)" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
            Loading…
          </div>
        )}

        {/* ── MAIN ── */}
        {isAuthenticated && !isLoading && (
          <>
            {/* Stats */}
            <MiniDashboard tasks={tasks} />

            {/* View switcher */}
            <div className="dtt-card" style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="dtt-tabs">
                  <button
                    className={`dtt-tab${viewMode === "table" ? " dtt-tabActive" : ""}`}
                    onClick={() => setViewMode("table")}
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span>⊞</span> Table
                  </button>
                  <button
                    className={`dtt-tab${viewMode === "kanban" ? " dtt-tabActive" : ""}`}
                    onClick={() => setViewMode("kanban")}
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ letterSpacing: 2 }}>⋮⋮⋮</span> Kanban
                  </button>
                </div>
                <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                  {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Content */}
            {viewMode === "kanban" ? (
              <KanbanBoard tasks={tasks} />
            ) : (
              <TaskTable tasks={tasks} />
            )}
          </>
        )}

      </div>
    </div>
  );
}