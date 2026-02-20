// src/components/TaskComments.jsx
import { useEffect, useRef, useState } from "react";

export default function TaskComments({ taskId, getToken, currentUserEmail }) {
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [posting, setPosting]   = useState(false);
  const bottomRef = useRef(null);

  async function apiFetch(path, opts = {}) {
    const token = getToken ? await getToken() : null;
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(path, { ...opts, headers });
  }

  async function load() {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/comments?taskId=${encodeURIComponent(taskId)}`);
      if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [taskId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments]);

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await apiFetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, body: text.trim() }),
      });
      if (res.ok) { const d = await res.json(); setComments(c => [...c, d.comment]); setText(""); }
    } finally { setPosting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this comment?")) return;
    await apiFetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setComments(c => c.filter(x => x.id !== id));
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        💬 Comments <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>{comments.length}</span>
      </div>

      {/* Comment list */}
      <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
        {loading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div>}
        {!loading && comments.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
            No comments yet. Be the first to add one.
          </div>
        )}
        {comments.map(c => {
          const isMe = c.authorEmail === currentUserEmail;
          return (
            <div key={c.id} style={{
              padding: "10px 14px", borderRadius: 12,
              border: `1px solid ${isMe ? "rgba(77,124,255,0.3)" : "var(--border)"}`,
              background: isMe ? "rgba(77,124,255,0.08)" : "rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: "linear-gradient(135deg,#4d7cff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                    {(c.authorName || c.authorEmail || "?")[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 12 }}>{c.authorName || c.authorEmail}</span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{timeAgo(c.createdAt)}</span>
                </div>
                {isMe && (
                  <button onClick={() => handleDelete(c.id)}
                    style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                    🗑️
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13, lineHeight: "18px", whiteSpace: "pre-wrap" }}>{c.body}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Post comment */}
      <form onSubmit={handlePost} style={{ display: "flex", gap: 8 }}>
        <textarea className="dtt-input" value={text} onChange={e => setText(e.target.value)}
          placeholder="Write a comment… (Shift+Enter for new line)"
          rows={2} style={{ flex: 1, resize: "none", fontSize: 13 }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(e); } }} />
        <button type="submit" className="dtt-btnPrimary" disabled={posting || !text.trim()}
          style={{ alignSelf: "flex-end", padding: "10px 16px", borderRadius: 12, flexShrink: 0 }}>
          {posting ? "…" : "Post"}
        </button>
      </form>
    </div>
  );
}