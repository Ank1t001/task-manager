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
  const [viewMode, setViewMode] = useState("table"); // "table" | "kanban"

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const organization = import.meta.env.VITE_AUTH0_ORG_ID;
  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/`;

  const apiBase = useMemo(() => "/api", []);

  async function getToken() {
    // ✅ Always request token scoped to org (otherwise membership checks break)
    return await getAccessTokenSilently({
      authorizationParams: {
        audience,
        organization,
        scope: "openid profile email",
      },
    });
  }

  async function fetchJSON(path) {
    const token = await getToken();
    const res = await fetch(`${apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const contentType = res.headers.get("content-type") || "";

    // If Worker throws exception, Cloudflare sends HTML. Show readable error.
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `API Error: ${res.status} :: ${
          contentType.includes("application/json") ? text : text.slice(0, 800)
        }`
      );
    }

    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  }

  async function loadTasks() {
    setApiError("");
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }
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
    // ✅ This is the missing piece that prevents “refresh only” behavior
    await loginWithRedirect({
      authorizationParams: {
        audience,
        organization,
        redirect_uri: redirectUri,
        scope: "openid profile email",
      },
    });
  }

  function handleLogout() {
    logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, opacity: 0.9 }}>Digital Team Task Tracker</h1>
            <div style={{ marginTop: 8, color: "#444" }}>
              Signed in:{" "}
              <b>{isAuthenticated ? user?.email || user?.name : "Not signed in"}</b>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isAuthenticated ? (
              <button onClick={handleLogin}>Login</button>
            ) : (
              <button onClick={handleLogout}>Logout</button>
            )}
            <button onClick={loadTasks} disabled={!isAuthenticated}>
              Refresh
            </button>
          </div>
        </div>

        {apiError ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "#ffecec",
              color: "#7a0000",
              whiteSpace: "pre-wrap",
            }}
          >
            {apiError}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <MiniDashboard tasks={tasks} />
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button onClick={() => setViewMode("table")}>Table</button>
          <button onClick={() => setViewMode("kanban")}>Kanban</button>
        </div>

        <div style={{ marginTop: 16 }}>
          {viewMode === "kanban" ? (
            <KanbanBoard tasks={tasks} />
          ) : (
            <TaskTable tasks={tasks} />
          )}
        </div>

        {!isAuthenticated ? (
          <div style={{ marginTop: 16, color: "#666" }}>Login to load tasks.</div>
        ) : null}
      </div>
    </div>
  );
}