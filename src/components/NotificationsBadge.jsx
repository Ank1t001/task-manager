// src/components/NotificationsBadge.jsx
import { useEffect, useRef, useState } from "react";

export default function NotificationsBadge({ getToken, userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);
  const ref = useRef(null);

  async function apiFetch(path, opts = {}) {
    const token = getToken ? await getToken() : null;
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(path, { ...opts, headers });
  }

  async function load() {
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const d = await res.json();
        setNotifications(d.notifications || []);
        setUnread(d.unreadCount || 0);
      }
    } catch {}
  }

  // Poll every 30 seconds
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [userEmail]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await apiFetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications(n => n.map(x => ({ ...x, read: 1 })));
    setUnread(0);
  }

  async function markRead(id) {
    await apiFetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: 1 } : x));
    setUnread(u => Math.max(0, u - 1));
  }

  function typeIcon(type) {
    if (type === "comment")  return "💬";
    if (type === "assigned") return "👤";
    if (type === "overdue")  return "⚠️";
    if (type === "stage")    return "📋";
    return "🔔";
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="dtt-iconBtn" onClick={() => { setOpen(o => !o); if (!open) load(); }}
        style={{ position: "relative", fontSize: 18 }} title="Notifications">
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            width: 18, height: 18, borderRadius: 999,
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg)",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          width: 340, maxHeight: 480, overflowY: "auto",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Notifications {unread > 0 && <span style={{ color: "#ef4444" }}>({unread})</span>}</div>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 11, color: "rgba(77,124,255,0.9)", background: "none", border: "none", cursor: "pointer", fontWeight: 900 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications yet</div>
          ) : (
            <div>
              {notifications.map(n => (
                <div key={n.id} onClick={() => !n.read && markRead(n.id)}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid var(--border)",
                    background: n.read ? "transparent" : "rgba(77,124,255,0.08)",
                    cursor: n.read ? "default" : "pointer",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, lineHeight: "16px", fontWeight: n.read ? 400 : 700 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: 999, background: "#4d7cff", flexShrink: 0, marginTop: 4 }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}