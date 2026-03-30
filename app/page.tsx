"use client";

import { useState, useEffect, useCallback } from "react";
import type { PersonalContext } from "@/lib/types";

const BASE_URL = "https://personal-context-mcp.vercel.app";

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadContext(token: string): Promise<PersonalContext> {
  const res = await fetch(`${BASE_URL}/context?token=${token}`);
  if (!res.ok) throw new Error("Failed to load context");
  return res.json();
}

async function saveContext(token: string, ctx: PersonalContext): Promise<void> {
  const res = await fetch(`${BASE_URL}/mcp?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "pctx_update_context", arguments: ctx },
    }),
  });
  if (!res.ok) throw new Error("Failed to save");
}

const EMPTY: PersonalContext = {
  identity: { name: "", pronouns: "", communicationStyle: "" },
  projects: [],
  relationships: [],
  preferences: [],
  customInstructions: "",
};

// ── styles ───────────────────────────────────────────────────────────────────

const s = {
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(247,245,250,0.1)",
    borderRadius: 8,
    color: "#f7f5fa",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    color: "rgba(247,245,250,0.4)",
    marginBottom: 4,
    display: "block",
  } as React.CSSProperties,
  section: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "rgba(247,245,250,0.35)",
    marginBottom: 2,
  },
  pill: (color: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: `${color}15`,
    border: `1px solid ${color}30`,
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 13,
    color,
  } as React.CSSProperties),
  removeBtn: {
    background: "none",
    border: "none",
    color: "rgba(247,245,250,0.25)",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
  } as React.CSSProperties,
  addBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px dashed rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "rgba(247,245,250,0.4)",
    cursor: "pointer",
    fontSize: 13,
    padding: "8px 12px",
    width: "100%",
    textAlign: "left" as const,
  },
};

// ── sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean;
}) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...s.input, fontFamily: mono ? "monospace" : "inherit" }}
      />
    </div>
  );
}

function ProjectRow({ project, onChange, onRemove }: {
  project: PersonalContext["projects"][0];
  onChange: (p: PersonalContext["projects"][0]) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ flex: 1, display: "flex", gap: 8 }}>
        <input value={project.name} onChange={(e) => onChange({ ...project, name: e.target.value })}
          placeholder="Name" style={{ ...s.input, width: "30%" }} />
        <input value={project.description} onChange={(e) => onChange({ ...project, description: e.target.value })}
          placeholder="Description" style={{ ...s.input, flex: 1 }} />
        <select value={project.status} onChange={(e) => onChange({ ...project, status: e.target.value })}
          style={{ ...s.input, width: 110, cursor: "pointer" }}>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="complete">complete</option>
          <option value="archived">archived</option>
        </select>
      </div>
      <button onClick={onRemove} style={{ ...s.removeBtn, marginTop: 10 }}>✕</button>
    </div>
  );
}

function RelRow({ rel, onChange, onRemove }: {
  rel: PersonalContext["relationships"][0];
  onChange: (r: PersonalContext["relationships"][0]) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input value={rel.name} onChange={(e) => onChange({ ...rel, name: e.target.value })}
        placeholder="Name" style={{ ...s.input, width: "35%" }} />
      <input value={rel.role} onChange={(e) => onChange({ ...rel, role: e.target.value })}
        placeholder="Role (e.g. partner, co-founder)" style={{ ...s.input, flex: 1 }} />
      <button onClick={onRemove} style={s.removeBtn}>✕</button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [ctx, setCtx] = useState<PersonalContext>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [newPref, setNewPref] = useState("");
  const [copied, setCopied] = useState(false);

  const mcpUrl = token ? `${BASE_URL}/mcp?token=${token}` : "";

  const load = useCallback(async (t: string) => {
    setStatus("loading");
    try {
      const data = await loadContext(t);
      setCtx(data);
      setToken(t);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  // Persist token in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pctx:token");
    if (saved) load(saved);
  }, [load]);

  const handleGenerate = () => {
    const t = crypto.randomUUID();
    localStorage.setItem("pctx:token", t);
    setCtx(EMPTY);
    setToken(t);
    setStatus("idle");
  };

  const handleEnterToken = () => {
    if (!tokenInput.trim()) return;
    localStorage.setItem("pctx:token", tokenInput.trim());
    load(tokenInput.trim());
  };

  const save = async () => {
    setStatus("saving");
    try {
      await saveContext(token, ctx);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateProject = (i: number, p: PersonalContext["projects"][0]) =>
    setCtx((c) => ({ ...c, projects: c.projects.map((x, j) => j === i ? p : x) }));
  const removeProject = (i: number) =>
    setCtx((c) => ({ ...c, projects: c.projects.filter((_, j) => j !== i) }));
  const addProject = () =>
    setCtx((c) => ({ ...c, projects: [...c.projects, { name: "", description: "", status: "active" }] }));

  const updateRel = (i: number, r: PersonalContext["relationships"][0]) =>
    setCtx((c) => ({ ...c, relationships: c.relationships.map((x, j) => j === i ? r : x) }));
  const removeRel = (i: number) =>
    setCtx((c) => ({ ...c, relationships: c.relationships.filter((_, j) => j !== i) }));
  const addRel = () =>
    setCtx((c) => ({ ...c, relationships: [...c.relationships, { name: "", role: "" }] }));

  const addPref = () => {
    if (!newPref.trim()) return;
    setCtx((c) => ({ ...c, preferences: [...c.preferences, newPref.trim()] }));
    setNewPref("");
  };
  const removePref = (i: number) =>
    setCtx((c) => ({ ...c, preferences: c.preferences.filter((_, j) => j !== i) }));

  // ── no token yet ────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <main style={{ padding: "64px 32px", maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Personal Context MCP</h1>
        <p style={{ color: "rgba(247,245,250,0.45)", marginBottom: 40, lineHeight: 1.6 }}>
          Inject your identity, projects, and relationships into your Claude — automatically, every time you join a Cha(t)os room.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          <button onClick={handleGenerate} style={{
            background: "#DFA649", color: "#0f0f11", border: "none",
            borderRadius: 10, padding: "13px 24px", fontWeight: 700,
            fontSize: 15, cursor: "pointer", textAlign: "left",
          }}>
            Generate my personal URLs →
          </button>

          <p style={{ fontSize: 12, color: "rgba(247,245,250,0.25)", textAlign: "center" }}>or</p>

          <div style={{ display: "flex", gap: 8 }}>
            <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEnterToken()}
              placeholder="Paste existing token"
              style={{ ...s.input, flex: 1 }} />
            <button onClick={handleEnterToken} style={{
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#f7f5fa", cursor: "pointer", fontSize: 14, padding: "9px 16px",
            }}>
              Load →
            </button>
          </div>
        </div>

        {status === "error" && (
          <p style={{ color: "#ff9090", fontSize: 13 }}>Couldn&apos;t load that token — double-check it and try again.</p>
        )}
      </main>
    );
  }

  // ── editor ──────────────────────────────────────────────────────────────────
  return (
    <main style={{ padding: "40px 32px", maxWidth: 680, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Personal Context</h1>
          <p style={{ fontSize: 13, color: "rgba(247,245,250,0.35)", margin: 0 }}>
            Changes auto-save when you click Save.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={copy} style={{
            background: "rgba(139,189,185,0.1)", border: "1px solid rgba(139,189,185,0.2)",
            borderRadius: 8, color: "#8CBDB9", cursor: "pointer", fontSize: 13, padding: "7px 14px",
          }}>
            {copied ? "Copied ✓" : "Copy MCP URL"}
          </button>
          <button onClick={save} disabled={status === "saving" || status === "loading"} style={{
            background: status === "saved" ? "rgba(151,209,129,0.15)" : "#DFA649",
            border: "none", borderRadius: 8,
            color: status === "saved" ? "#97D181" : "#0f0f11",
            cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 20px",
            opacity: status === "saving" ? 0.6 : 1,
          }}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {status === "loading" && (
        <p style={{ color: "rgba(247,245,250,0.3)", fontSize: 13, marginBottom: 24 }}>Loading your context…</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Identity */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Identity</p>
          <Field label="Name" value={ctx.identity.name}
            onChange={(v) => setCtx((c) => ({ ...c, identity: { ...c.identity, name: v } }))}
            placeholder="e.g. Nae" />
          <Field label="Pronouns" value={ctx.identity.pronouns ?? ""}
            onChange={(v) => setCtx((c) => ({ ...c, identity: { ...c.identity, pronouns: v } }))}
            placeholder="e.g. she/her" />
          <Field label="Communication style" value={ctx.identity.communicationStyle ?? ""}
            onChange={(v) => setCtx((c) => ({ ...c, identity: { ...c.identity, communicationStyle: v } }))}
            placeholder="e.g. direct, ADHD-friendly, no fluff" />
        </div>

        {/* Custom instructions */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Custom Instructions</p>
          <textarea value={ctx.customInstructions}
            onChange={(e) => setCtx((c) => ({ ...c, customInstructions: e.target.value }))}
            placeholder="Freeform instructions for your Claude — mirrors Claude Desktop memory."
            rows={4}
            style={{ ...s.input, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Projects */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Projects</p>
          {ctx.projects.map((p, i) => (
            <ProjectRow key={i} project={p}
              onChange={(updated) => updateProject(i, updated)}
              onRemove={() => removeProject(i)} />
          ))}
          <button onClick={addProject} style={s.addBtn}>+ Add project</button>
        </div>

        {/* Relationships */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Relationships</p>
          {ctx.relationships.map((r, i) => (
            <RelRow key={i} rel={r}
              onChange={(updated) => updateRel(i, updated)}
              onRemove={() => removeRel(i)} />
          ))}
          <button onClick={addRel} style={s.addBtn}>+ Add person</button>
        </div>

        {/* Preferences */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Preferences</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ctx.preferences.map((pref, i) => (
              <span key={i} style={s.pill("#88739E")}>
                {pref}
                <button onClick={() => removePref(i)} style={s.removeBtn}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newPref} onChange={(e) => setNewPref(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPref()}
              placeholder="Add a preference and press Enter"
              style={{ ...s.input, flex: 1 }} />
            <button onClick={addPref} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(247,245,250,0.6)", cursor: "pointer", fontSize: 13, padding: "9px 14px",
            }}>Add</button>
          </div>
        </div>

        {/* MCP URL */}
        <div style={{ padding: "14px 16px", background: "rgba(139,189,185,0.06)", border: "1px solid rgba(139,189,185,0.15)", borderRadius: 12 }}>
          <p style={{ fontSize: 11, color: "rgba(247,245,250,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your MCP URL</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ fontSize: 12, color: "#8CBDB9", flex: 1, wordBreak: "break-all" }}>{mcpUrl}</code>
            <button onClick={copy} style={{
              background: "rgba(139,189,185,0.1)", border: "1px solid rgba(139,189,185,0.2)",
              borderRadius: 6, color: "#8CBDB9", cursor: "pointer", fontSize: 12, padding: "5px 10px", whiteSpace: "nowrap",
            }}>
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <button onClick={() => { localStorage.removeItem("pctx:token"); setToken(""); setCtx(EMPTY); }}
            style={{ background: "none", border: "none", color: "rgba(247,245,250,0.2)", cursor: "pointer", fontSize: 12 }}>
            Switch account / use different token
          </button>
        </div>

      </div>
    </main>
  );
}
