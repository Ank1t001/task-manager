// src/components/UserManagement.jsx
import { useEffect, useState } from "react";

const ROLES = ["admin", "manager", "member", "viewer"];

const ROLE_COLORS = {
  admin:   { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",   text: "#f87171" },
  manager: { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.4)",  text: "#fbbf24" },
  member:  { bg: "rgba(77,124,255,0.12)",  border: "rgba(77,124,255,0.4)",  text: "#93c5fd" },
  viewer:  { bg: "rgba(160,160,160,0.12)", border: "rgba(160,160,160,0.4)", text: "#9ca3af" },
};

const ROLE_DESCRIPTIONS = {
  admin:   "Full access — manage users, projects, tasks, and settings",
  manager: "Can create projects, assign tasks, edit anything",
  member:  "Can view and work on assigned tasks only",
  viewer:  "Read-only access, cannot edit anything",
};

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 900, border: `1px solid ${c.border}`, background: c.bg, color: c.text }}>
      {role}
    </span>
  );
}

export default function UserManagement({ getToken, currentUserEmail }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(null); // email being saved
  const [error, setError]       = useState("");

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("member");
  const [inviting, setInviting]       = useState(false);

  async function apiFetch(path, opts = {}) {
    const token = getToken ? await getToken() : null;
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(path, { ...opts, headers });
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/users");
      if (res.ok) { const d = await res.json(); setUsers(d.users || []); }
      else { const d = await res.json(); setError(d.error || "Failed to load users"); }
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleRoleChange(email, newRole) {
    setSaving(email);
    try {
      const res = await apiFetch("/api/users", {
        method: "PUT",
        body: JSON.stringify({ email, role: newRole }),
      });
      if (res.ok) setUsers(u => u.map(x => x.email === email ? { ...x, role: newRole } : x));
      else { const d = await res.json(); setError(d.error || "Failed to update role"); }
    } finally { setSaving(null); }
  }

  async function handleRemove(email, name) {
    if (!confirm(`Remove ${name} (${email}) from the team?`)) return;
    setSaving(email);
    try {
      const res = await apiFetch(`/api/users?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      if (res.ok) setUsers(u => u.filter(x => x.email !== email));
      else { const d = await res.json(); setError(d.error || "Failed to remove user"); }
    } finally { setSaving(null); }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true); setError("");
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await res.json();
      if (res.ok) {
        setUsers(u => [...u, { name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }]);
        setInviteName(""); setInviteEmail(""); setInviteRole("member"); setShowInvite(false);
      } else { setError(d.error || "Failed to add user"); }
    } finally { setInviting(false); }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>👥 Team Members</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Manage roles and access for your team
          </div>
        </div>
        <button className="dtt-btnPrimary" onClick={() => setShowInvite(v => !v)}
          style={{ padding: "10px 18px", fontWeight: 900, borderRadius: 12, fontSize: 14 }}>
          + Add Member
        </button>
      </div>

      {/* Role legend */}
      <div className="dtt-card" style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 900, fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>ROLE PERMISSIONS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {ROLES.map(role => (
            <div key={role} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <RoleBadge role={role} />
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: "16px" }}>{ROLE_DESCRIPTIONS[role]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="dtt-card" style={{ border: "1px solid rgba(77,124,255,0.3)", background: "rgba(77,124,255,0.05)" }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14 }}>➕ Add New Team Member</div>
          <form onSubmit={handleInvite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Full Name</label>
              <input className="dtt-input" value={inviteName} onChange={e => setInviteName(e.target.value)}
                placeholder="Jane Smith" required />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Email</label>
              <input className="dtt-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="jane@company.com" required />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Role</label>
              <select className="dtt-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 130 }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="dtt-btnPrimary" disabled={inviting} style={{ padding: "11px 18px", borderRadius: 12, fontWeight: 900 }}>
                {inviting ? "Adding…" : "Add"}
              </button>
              <button type="button" className="dtt-btn" onClick={() => setShowInvite(false)} style={{ padding: "11px 14px", borderRadius: 12 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* User list */}
      <div className="dtt-card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Member", "Email", "Role", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No team members yet</td></tr>
            )}
            {users.map((u, i) => {
              const isMe  = u.email?.toLowerCase() === currentUserEmail?.toLowerCase();
              const isBusy = saving === u.email;
              return (
                <tr key={u.id || u.email} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 999, background: "linear-gradient(135deg,#4d7cff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                        {(u.name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{u.name || "—"} {isMe && <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>(you)</span>}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {isMe ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <select
                        value={u.role} disabled={isBusy}
                        onChange={e => handleRoleChange(u.email, e.target.value)}
                        style={{
                          padding: "5px 10px", borderRadius: 10, fontSize: 12, fontWeight: 900,
                          border: `1px solid ${ROLE_COLORS[u.role]?.border || "var(--border)"}`,
                          background: ROLE_COLORS[u.role]?.bg || "transparent",
                          color: ROLE_COLORS[u.role]?.text || "var(--text)",
                          cursor: "pointer", outline: "none",
                        }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {!isMe && (
                      <button onClick={() => handleRemove(u.email, u.name)} disabled={isBusy}
                        style={{ fontSize: 12, color: "#f87171", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 700 }}>
                        {isBusy ? "…" : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}