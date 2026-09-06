"use client";

import { useState, useEffect, useCallback } from "react";
import type { PersonalContext, ClaudeIdentity, Fact, Relationship } from "@/lib/types";
import { FACT_CATEGORIES, FACT_CONFIDENCES } from "@/lib/types";

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
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error.message ?? "Failed to save");
}

const EMPTY: PersonalContext = {
  user: { name: "", pronouns: "", communicationStyle: "" },
  claudeIdentities: [],
  facts: [],
  relationships: [],
  preferences: [],
};

/** Today as YYYY-MM — the default `established` for a newly added fact. */
const thisMonth = () => new Date().toISOString().slice(0, 7);

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
  sectionHint: {
    fontSize: 12,
    color: "rgba(247,245,250,0.28)",
    margin: "-8px 0 0 0",
    lineHeight: 1.5,
  } as React.CSSProperties,
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

function FactRow({ fact, onChange, onRemove }: {
  fact: Fact;
  onChange: (f: Fact) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const undated = !/^\d{4}(-\d{2}){0,2}$/.test(fact.established ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={fact.label} onChange={(e) => onChange({ ...fact, label: e.target.value })}
          placeholder="Label (e.g. Dialect profile)" style={{ ...s.input, flex: 1 }} />
        <button onClick={() => setExpanded(!expanded)}
          style={{ ...s.removeBtn, fontSize: 12, color: "rgba(247,245,250,0.35)" }}
          title="Toggle source">{expanded ? "▾" : "▸"}</button>
        <button onClick={onRemove} style={s.removeBtn}>✕</button>
      </div>

      {/* Meta row: the two selects share the leftover width, the date keeps a fixed one. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={fact.category}
          onChange={(e) => onChange({ ...fact, category: e.target.value as Fact["category"] })}
          style={{ ...s.input, flex: 1, minWidth: 0, cursor: "pointer" }}>
          {FACT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={fact.established ?? ""}
          onChange={(e) => onChange({ ...fact, established: e.target.value })}
          placeholder="YYYY-MM"
          title="When this became true. Required — undated facts rot invisibly."
          style={{
            ...s.input,
            width: 104,
            flex: "0 0 auto",
            fontFamily: "monospace",
            borderColor: undated ? "rgba(255,144,144,0.5)" : undefined,
          }} />
        <select value={fact.confidence ?? ""}
          onChange={(e) => onChange({ ...fact, confidence: (e.target.value || undefined) as Fact["confidence"] })}
          style={{ ...s.input, flex: 1, minWidth: 0, cursor: "pointer" }}>
          <option value="">confidence…</option>
          {FACT_CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <textarea value={fact.content}
        onChange={(e) => onChange({ ...fact, content: e.target.value })}
        placeholder="The fact itself."
        rows={3} style={{ ...s.input, resize: "vertical", lineHeight: 1.6 }} />

      {expanded && (
        <input value={fact.source ?? ""}
          onChange={(e) => onChange({ ...fact, source: e.target.value || undefined })}
          placeholder="Source (e.g. Praat/parselmouth analysis of own recordings)"
          style={{ ...s.input, fontStyle: "italic" }} />
      )}
    </div>
  );
}

function RelRow({ rel, onChange, onRemove }: {
  rel: Relationship;
  onChange: (r: Relationship) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContext = !!(rel.context?.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={rel.name} onChange={(e) => onChange({ ...rel, name: e.target.value })}
          placeholder="Name" style={{ ...s.input, width: "35%" }} />
        <input value={rel.role} onChange={(e) => onChange({ ...rel, role: e.target.value })}
          placeholder="Role (e.g. Partner, Co-leader)" style={{ ...s.input, flex: 1 }} />
        <button onClick={() => setExpanded(!expanded)}
          style={{ ...s.removeBtn, fontSize: 12, color: hasContext ? "#8CBDB9" : "rgba(247,245,250,0.35)" }}
          title="Toggle context">{expanded ? "▾" : "▸"}</button>
        <button onClick={onRemove} style={s.removeBtn}>✕</button>
      </div>
      {expanded && (
        <textarea value={rel.context ?? ""}
          onChange={(e) => onChange({ ...rel, context: e.target.value || undefined })}
          placeholder="Context — personality, lore, how you know them (only injected when relevant)"
          rows={2} style={{ ...s.input, resize: "vertical", lineHeight: 1.6 }} />
      )}
    </div>
  );
}

function ClaudeIdentityRow({ ci, onChange, onRemove }: {
  ci: ClaudeIdentity;
  onChange: (c: ClaudeIdentity) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={ci.name} onChange={(e) => onChange({ ...ci, name: e.target.value })}
          placeholder="Name (e.g. Coru)" style={{ ...s.input, width: "30%" }} />
        <input value={ci.role} onChange={(e) => onChange({ ...ci, role: e.target.value })}
          placeholder="Role (e.g. Planning and architecture, Implementation partner)" style={{ ...s.input, flex: 1 }} />
        <button onClick={onRemove} style={s.removeBtn}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={ci.home} onChange={(e) => onChange({ ...ci, home: e.target.value })}
          placeholder="Home (e.g. claude.ai)" style={{ ...s.input, flex: 1 }} />
        <input value={ci.access} onChange={(e) => onChange({ ...ci, access: e.target.value })}
          placeholder="Access (e.g. Full pctx memory)" style={{ ...s.input, flex: 1 }} />
      </div>
      <input value={ci.blurb} onChange={(e) => onChange({ ...ci, blurb: e.target.value })}
        placeholder="Self-description (e.g. Coru lives in claude.ai.)" style={{ ...s.input, fontStyle: "italic" }} />
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [ctx, setCtx] = useState<PersonalContext>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [newPref, setNewPref] = useState("");
  const [copied, setCopied] = useState(false);

  const mcpUrl = token ? `${BASE_URL}/mcp?token=${token}` : "";

  const load = useCallback(async (t: string) => {
    setStatus("loading");
    try {
      const data = await loadContext(t);
      setCtx({ ...EMPTY, ...data });
      setToken(t);
      setStatus("idle");
    } catch {
      setErrorMsg("Couldn't load that token — double-check it and try again.");
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
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save.");
      setStatus("error");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateFact = (i: number, f: Fact) =>
    setCtx((c) => ({ ...c, facts: c.facts.map((x, j) => j === i ? f : x) }));
  const removeFact = (i: number) =>
    setCtx((c) => ({ ...c, facts: c.facts.filter((_, j) => j !== i) }));
  const addFact = () =>
    setCtx((c) => ({
      ...c,
      facts: [...c.facts, { label: "", category: "biographical" as const, content: "", established: thisMonth() }],
    }));

  const updateRel = (i: number, r: Relationship) =>
    setCtx((c) => ({ ...c, relationships: c.relationships.map((x, j) => j === i ? r : x) }));
  const removeRel = (i: number) =>
    setCtx((c) => ({ ...c, relationships: c.relationships.filter((_, j) => j !== i) }));
  const addRel = () =>
    setCtx((c) => ({ ...c, relationships: [...c.relationships, { name: "", role: "" }] }));

  const updateClaudeId = (i: number, ci: ClaudeIdentity) =>
    setCtx((c) => ({ ...c, claudeIdentities: (c.claudeIdentities ?? []).map((x, j) => j === i ? ci : x) }));
  const removeClaudeId = (i: number) =>
    setCtx((c) => ({ ...c, claudeIdentities: (c.claudeIdentities ?? []).filter((_, j) => j !== i) }));
  const addClaudeId = () =>
    setCtx((c) => ({ ...c, claudeIdentities: [...(c.claudeIdentities ?? []), { name: "", role: "", home: "", access: "", blurb: "" }] }));

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
          The durable facts about you that no codebase or task tracker holds — served to any Claude that connects to your URL.
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
          <p style={{ color: "#ff9090", fontSize: 13 }}>{errorMsg}</p>
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
            Changes save when you click Save.
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
      {status === "error" && (
        <p style={{ color: "#ff9090", fontSize: 13, marginBottom: 24 }}>{errorMsg}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* About you */}
        <div style={s.section}>
          <p style={s.sectionTitle}>About You</p>
          <Field label="Name" value={ctx.user.name}
            onChange={(v) => setCtx((c) => ({ ...c, user: { ...c.user, name: v } }))}
            placeholder="e.g. Nae" />
          <Field label="Pronouns" value={ctx.user.pronouns ?? ""}
            onChange={(v) => setCtx((c) => ({ ...c, user: { ...c.user, pronouns: v } }))}
            placeholder="e.g. she/they" />
          <Field label="Preferred communication style" value={ctx.user.communicationStyle ?? ""}
            onChange={(v) => setCtx((c) => ({ ...c, user: { ...c.user, communicationStyle: v } }))}
            placeholder="e.g. direct, no fluff, explain new concepts briefly" />
        </div>

        {/* Claude Identities */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Claude Identities</p>
          {(ctx.claudeIdentities ?? []).map((ci, i) => (
            <ClaudeIdentityRow key={i} ci={ci}
              onChange={(updated) => updateClaudeId(i, updated)}
              onRemove={() => removeClaudeId(i)} />
          ))}
          <button onClick={addClaudeId} style={s.addBtn}>+ Add Claude identity</button>
        </div>

        {/* Facts */}
        <div style={s.section}>
          <p style={s.sectionTitle}>Facts</p>
          <p style={s.sectionHint}>
            Durable things about you that aren&apos;t reconstructible from a codebase or ChaosPatch.
            Every fact carries a date so staleness announces itself.
          </p>
          {ctx.facts.map((f, i) => (
            <FactRow key={i} fact={f}
              onChange={(updated) => updateFact(i, updated)}
              onRemove={() => removeFact(i)} />
          ))}
          <button onClick={addFact} style={s.addBtn}>+ Add fact</button>
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
          <p style={s.sectionTitle}>Preferences for Claude</p>
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
              placeholder="e.g. Always use TypeScript, prefer concise responses"
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
          <p style={{ fontSize: 11, color: "rgba(247,245,250,0.25)", marginTop: 8, margin: "8px 0 0 0" }}>
            Tip: Add <code style={{ color: "#8CBDB9" }}>&name=Coru</code> to mark that identity{" "}
            <code style={{ color: "#8CBDB9" }}>self: true</code> in the response.
          </p>
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
