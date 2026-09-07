"use client";

import { useState, useEffect, useCallback } from "react";
import type { PersonalContext, ClaudeIdentity, Fact, Relationship } from "@/lib/types";
import { FACT_CATEGORIES, FACT_CONFIDENCES } from "@/lib/types";

const BASE_URL = "https://personal-context-mcp.vercel.app";

type Account = { email: string; contextToken: string; createdAt: string };

type Conflict = {
  collection: "user" | "facts" | "relationships" | "claudeIdentities";
  key: string;
  account: unknown;
  token: unknown;
};

type LinkPlan = {
  clean: boolean;
  accountIsEmpty: boolean;
  conflicts: Conflict[];
  additions: {
    fromAccount: { facts: string[]; relationships: string[]; claudeIdentities: string[] };
    fromToken: { facts: string[]; relationships: string[]; claudeIdentities: string[] };
  };
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function api<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(payload.error ?? "Request failed"), { payload });
  return payload as T;
}

async function loadContext(token: string): Promise<PersonalContext> {
  const res = await fetch(`${BASE_URL}/context?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Failed to load context");
  return res.json();
}

async function saveContext(token: string, ctx: PersonalContext): Promise<void> {
  const res = await fetch(`${BASE_URL}/mcp?token=${encodeURIComponent(token)}`, {
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
};

/** Today as YYYY-MM — the default `established` for a newly added fact. */
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ── styles ───────────────────────────────────────────────────────────────────

/**
 * Section accent colours. Each section gets a rule in its own colour so the
 * five cards are tellable apart at a glance instead of being five identical
 * boxes — but every one of them still carries its text title, so the colour is
 * never the only thing carrying the meaning.
 */
/**
 * Editor shell width. At least 60vw on anything desktop-sized, floored at 680px
 * so it doesn't collapse on a narrow laptop, and capped at 92vw so it never
 * runs into the window edge on a phone.
 *
 *   1200px viewport -> 720px (60vw)   1920px -> 1152px (60vw)
 *    1000px         -> 680px (68vw)    600px ->  552px (92vw)
 */
const SHELL = "min(92vw, max(680px, 60vw))";

const ACCENT = {
  user: "var(--marine)",
  identities: "var(--plum-lift)",
  facts: "var(--teal)",
  relationships: "var(--tan)",
  link: "var(--text-3)",
} as const;

const s = {
  input: {
    background: "var(--well)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    padding: "9px 12px",
    width: "100%",
    transition: "border-color 120ms ease, background 120ms ease",
  } as React.CSSProperties,
  label: {
    fontSize: 13,
    color: "var(--text-2)",
    marginBottom: 5,
    display: "block",
  } as React.CSSProperties,
  section: (accent: string = ACCENT.user) =>
    ({
      background: "var(--card)",
      border: "1px solid var(--line-soft)",
      borderLeft: `3px solid ${accent}`,
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }) as React.CSSProperties,
  sectionTitle: {
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "var(--text)",
    margin: "0 0 2px",
  } as React.CSSProperties,
  sectionHint: {
    fontSize: 13,
    color: "var(--text-2)",
    margin: "-8px 0 0 0",
    lineHeight: 1.5,
    /* Reading text, not an input — capped so widening the shell doesn't
       stretch it into an unreadable single line. */
    maxWidth: "72ch",
  } as React.CSSProperties,
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-2)",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
    padding: "4px 6px",
    borderRadius: 6,
  } as React.CSSProperties,
  addBtn: {
    background: "transparent",
    border: "1px dashed var(--line)",
    borderRadius: "var(--radius)",
    color: "var(--text-2)",
    cursor: "pointer",
    fontSize: 14,
    padding: "10px 12px",
    width: "100%",
    textAlign: "left" as const,
    fontFamily: "inherit",
  } as React.CSSProperties,
  ghostBtn: {
    background: "transparent",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    color: "var(--marine)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={fact.label} onChange={(e) => onChange({ ...fact, label: e.target.value })}
          placeholder="Label (e.g. Dialect profile)" style={{ ...s.input, flex: 1 }} />
        <button onClick={() => setExpanded(!expanded)}
          style={{ ...s.removeBtn, fontSize: 12, color: "var(--text-2)" }}
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
            borderColor: undated ? "var(--danger)" : undefined,
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
  const misdated = !!rel.established && !/^\d{4}(-\d{2}){0,2}$/.test(rel.established);

  /**
   * Nicknames are stored as an array but edited as one comma-separated string.
   * The draft only exists while the field has focus — without it, round-tripping
   * through split/join eats the comma the moment you type it. Clearing on blur
   * also means a row recycled by index after a delete can't inherit a stale
   * draft, since you have to leave the field to click anything else.
   */
  const [nickDraft, setNickDraft] = useState<string | null>(null);
  const shownNicknames = nickDraft ?? (rel.nicknames ?? []).join(", ");
  const editNicknames = (raw: string) => {
    setNickDraft(raw);
    const parsed = raw.split(",").map((n) => n.trim()).filter(Boolean);
    onChange({ ...rel, nicknames: parsed.length ? parsed : undefined });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={rel.name} onChange={(e) => onChange({ ...rel, name: e.target.value })}
          placeholder="Name"
          title="The canonical name. This is how MCP tools address this person."
          style={{ ...s.input, width: "28%" }} />
        <input value={shownNicknames}
          onChange={(e) => editNicknames(e.target.value)}
          onBlur={() => setNickDraft(null)}
          placeholder="aka (comma-sep)"
          title="What you actually call them. Comma-separated."
          style={{ ...s.input, width: "24%" }} />
        <input value={rel.role} onChange={(e) => onChange({ ...rel, role: e.target.value })}
          placeholder="Role (e.g. Partner, Co-leader)" style={{ ...s.input, flex: 1, minWidth: 0 }} />
        <button onClick={() => setExpanded(!expanded)}
          style={{ ...s.removeBtn, fontSize: 12, color: hasContext ? "var(--marine)" : "var(--text-2)" }}
          title="Toggle context">{expanded ? "▾" : "▸"}</button>
        <button onClick={onRemove} style={s.removeBtn}>✕</button>
      </div>
      {/* Meta row: pronouns and the date keep fixed widths, affiliation takes the rest. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={rel.pronouns ?? ""}
          onChange={(e) => onChange({ ...rel, pronouns: e.target.value || undefined })}
          placeholder="pronouns"
          title="Free text. Leave blank if unknown — blank means ask, not they/them by default."
          style={{ ...s.input, width: 104, flex: "0 0 auto" }} />
        <input value={rel.affiliation ?? ""}
          onChange={(e) => onChange({ ...rel, affiliation: e.target.value || undefined })}
          placeholder="Affiliation (e.g. UD, Dept. of Linguistics & Cognitive Science)"
          style={{ ...s.input, flex: 1, minWidth: 0 }} />
        <input value={rel.established ?? ""}
          onChange={(e) => onChange({ ...rel, established: e.target.value || undefined })}
          placeholder="YYYY-MM"
          title="When the relationship started. Professional connections rot on a semester clock."
          style={{
            ...s.input,
            width: 104,
            flex: "0 0 auto",
            fontFamily: "monospace",
            borderColor: misdated ? "var(--danger)" : undefined,
          }} />
      </div>

      {expanded && (
        <textarea value={rel.context ?? ""}
          onChange={(e) => onChange({ ...rel, context: e.target.value || undefined })}
          placeholder="Context — personality, lore, how you know them, current vs. past (only injected when relevant)"
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
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

// ── auth screen ───────────────────────────────────────────────────────────────

function AuthScreen({ onAuthed }: { onAuthed: (a: Account) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const { account } = await api<{ account: Account }>("/api/auth", { action: mode, email, password });
      onAuthed(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <main style={{ padding: "64px 32px", maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{
        fontFamily: "var(--font-display), system-ui, sans-serif",
        fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", margin: "0 0 8px",
      }}>Personal Context</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 32, lineHeight: 1.6 }}>
        The durable facts about you that no codebase or task tracker holds — served to any Claude
        that connects to your URL.
      </p>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["login", "signup"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
            flex: 1, fontFamily: "inherit",
            background: mode === m ? "var(--raised)" : "transparent",
            border: "1px solid var(--line)", borderRadius: 8,
            color: mode === m ? "var(--text)" : "var(--text-2)",
            cursor: "pointer", fontSize: 13, fontWeight: mode === m ? 700 : 400, padding: "9px 0",
          }}>
            {m === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          autoComplete="email" placeholder="Email" style={s.input} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
          placeholder={mode === "signup" ? "Password (10+ characters)" : "Password"} style={s.input} />
        <button onClick={submit} disabled={busy || !email || !password} style={{
          background: "var(--marine)", color: "var(--ground)", border: "none", borderRadius: 10,
          padding: "13px 24px", fontWeight: 700, fontSize: 15, fontFamily: "inherit",
          cursor: busy ? "default" : "pointer", opacity: busy || !email || !password ? 0.5 : 1,
        }}>
          {busy ? "…" : mode === "login" ? "Log in →" : "Create account →"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 16 }}>{error}</p>}

      {mode === "signup" && (
        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 20, lineHeight: 1.6 }}>
          Already have a context token? Create the account first, then link the token from inside —
          your existing MCP URL keeps working.
        </p>
      )}
    </main>
  );
}

// ── link an existing token ────────────────────────────────────────────────────

function LinkPanel({ onLinked }: { onLinked: (token: string, ctx: PersonalContext) => void }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<LinkPlan | null>(null);
  const [choices, setChoices] = useState<Record<string, "account" | "token">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const conflictKey = (c: Conflict) => `${c.collection}:${c.key.trim().toLowerCase()}`;

  const preview = async () => {
    setBusy(true); setError(""); setNote(""); setPlan(null);
    try {
      const { plan } = await api<{ plan: LinkPlan }>("/api/link", { action: "preview", token });
      setPlan(plan);
      setChoices(Object.fromEntries(plan.conflicts.map((c) => [conflictKey(c), "token" as const])));
      if (plan.clean) setNote(plan.accountIsEmpty
        ? "Nothing in this account yet — the token will be adopted as-is."
        : "No conflicts. Everything merges cleanly.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check that token.");
    }
    setBusy(false);
  };

  const commit = async () => {
    setBusy(true); setError("");
    try {
      const r = await api<{ contextToken: string; context: PersonalContext }>(
        "/api/link", { action: "commit", token, resolutions: choices }
      );
      onLinked(r.contextToken, r.context);
      setOpen(false); setPlan(null); setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't link that token.");
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={s.addBtn}>
        + Link an existing context token
      </button>
    );
  }

  const totalAdds = (a: LinkPlan["additions"]["fromAccount"]) =>
    a.facts.length + a.relationships.length + a.claudeIdentities.length;

  return (
    <div style={{ ...s.section(ACCENT.link), gap: 12 }}>
      <p style={s.sectionTitle}>Link an existing token</p>
      <p style={s.sectionHint}>
        Paste the token or the full MCP URL. That token becomes this account&apos;s context, so any
        Claude already connected to it keeps working.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={token} onChange={(e) => { setToken(e.target.value); setPlan(null); }}
          placeholder="Token or https://…/mcp?token=…"
          style={{ ...s.input, flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: 12 }} />
        <button onClick={preview} disabled={busy || !token.trim()} style={{
          background: "var(--well)", border: "1px solid var(--line)",
          borderRadius: 8, color: "var(--text)", cursor: "pointer", fontSize: 13,
          padding: "9px 16px", whiteSpace: "nowrap", opacity: busy || !token.trim() ? 0.5 : 1,
        }}>
          {busy ? "…" : "Check"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      {note && <p style={{ color: "var(--ok)", fontSize: 13, margin: 0 }}>{note}</p>}

      {plan && (
        <>
          {(totalAdds(plan.additions.fromToken) > 0 || totalAdds(plan.additions.fromAccount) > 0) && (
            <p style={{ ...s.sectionHint, marginTop: 0 }}>
              Merging in {totalAdds(plan.additions.fromToken)} item(s) from the token
              {totalAdds(plan.additions.fromAccount) > 0
                ? `, keeping ${totalAdds(plan.additions.fromAccount)} already here`
                : ""}.
            </p>
          )}

          {plan.conflicts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: "var(--tan)", fontSize: 13, margin: 0 }}>
                {plan.conflicts.length} item(s) exist on both sides with different content. Pick which to keep.
              </p>
              {plan.conflicts.map((c) => {
                const k = conflictKey(c);
                return (
                  <div key={k} style={{ border: "1px solid var(--line-soft)", borderRadius: 8, padding: 10 }}>
                    <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 8px 0" }}>
                      <strong style={{ color: "var(--text)" }}>{c.key}</strong>
                      <span style={{ opacity: 0.5 }}> · {c.collection}</span>
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["token", "account"] as const).map((side) => (
                        <button key={side} onClick={() => setChoices((p) => ({ ...p, [k]: side }))}
                          style={{
                            flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer",
                            background: choices[k] === side ? "var(--raised)" : "var(--well)",
                            border: `1px solid ${choices[k] === side ? "var(--marine)" : "var(--line-soft)"}`,
                            borderRadius: 6, padding: 8, color: "var(--text)", fontSize: 11,
                          }}>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
                            color: choices[k] === side ? "var(--marine)" : "var(--text-2)", marginBottom: 4 }}>
                            {side === "token" ? "From token" : "In this account"}
                          </div>
                          <div style={{ maxHeight: 84, overflow: "auto", whiteSpace: "pre-wrap",
                            wordBreak: "break-word", opacity: 0.85, fontFamily: "monospace", lineHeight: 1.5 }}>
                            {JSON.stringify(side === "token" ? c.token : c.account, null, 1)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={commit} disabled={busy} style={{
              background: "var(--marine)", color: "var(--ground)", border: "none", borderRadius: 8,
              cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "9px 20px", opacity: busy ? 0.6 : 1,
            }}>
              {busy ? "Linking…" : plan.accountIsEmpty ? "Adopt this token" : "Merge and link"}
            </button>
            <button onClick={() => { setOpen(false); setPlan(null); setError(""); setNote(""); }} style={{
              background: "none", border: "1px solid var(--line)", borderRadius: 8,
              color: "var(--text-2)", cursor: "pointer", fontSize: 13, padding: "9px 16px",
            }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [booted, setBooted] = useState(false);
  const [ctx, setCtx] = useState<PersonalContext>(EMPTY);
  /** Guards Save: never write an editor state that was never successfully loaded. */
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  /** Serialised copy of the last state we know is on the server. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = account?.contextToken ?? "";
  const mcpUrl = token ? `${BASE_URL}/mcp?token=${token}` : "";

  const load = useCallback(async (t: string) => {
    setStatus("loading");
    setLoaded(false);
    try {
      const data = await loadContext(t);
      const fresh = { ...EMPTY, ...data };
      setCtx(fresh);
      setSavedSnapshot(JSON.stringify(fresh));
      setLoaded(true);
      setStatus("idle");
    } catch {
      setErrorMsg("Couldn't load your context. Reload before editing — saving now would overwrite it.");
      setStatus("error");
    }
  }, []);

  // Restore the session on mount.
  useEffect(() => {
    (async () => {
      try {
        const { account } = await api<{ account: Account | null }>("/api/auth", { action: "me" });
        if (account) {
          setAccount(account);
          await load(account.contextToken);
        }
      } catch {
        /* not signed in */
      }
      setBooted(true);
    })();
  }, [load]);

  const onAuthed = async (a: Account) => {
    setAccount(a);
    await load(a.contextToken);
  };

  const logout = async () => {
    await api("/api/auth", { action: "logout" });
    setAccount(null);
    setCtx(EMPTY);
    setSavedSnapshot(null);
    setLoaded(false);
  };

  const save = async () => {
    if (!loaded) return;
    setStatus("saving");
    // Snapshot what we actually send: edits made mid-save must stay dirty.
    const sent = ctx;
    try {
      await saveContext(token, sent);
      setSavedSnapshot(JSON.stringify(sent));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save.");
      setStatus("error");
    }
  };

  const dirty = loaded && savedSnapshot !== null && JSON.stringify(ctx) !== savedSnapshot;

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

  if (!booted) {
    return (
      <main style={{ padding: "64px 32px", maxWidth: 560, margin: "0 auto" }}>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>Loading…</p>
      </main>
    );
  }

  if (!account) return <AuthScreen onAuthed={onAuthed} />;

  // ── editor ──────────────────────────────────────────────────────────────────
  const saveLabel =
    status === "saving" ? "Saving…" : status === "saved" && !dirty ? "Saved ✓" : "Save";

  return (
    <>
      {/*
        Sticky, so Save is reachable from anywhere in a long context. It was
        previously at the top of a 700px-tall form, which meant scrolling back up
        to commit an edit you made at the bottom.
      */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--walnut)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            width: SHELL,
            margin: "0 auto",
            padding: "14px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display), system-ui, sans-serif",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Personal Context
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{account.email}</p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/*
              Unsaved work is the expensive failure in an editor, so the state is
              stated in words rather than implied by an enabled button. Colour is
              never the only carrier — the text changes too.
            */}
            <span
              style={{
                fontSize: 12,
                color: dirty ? "var(--tan)" : "var(--text-2)",
                whiteSpace: "nowrap",
              }}
            >
              {dirty ? "● Unsaved changes" : status === "saved" ? "All changes saved" : ""}
            </span>

            <button onClick={copy} style={s.ghostBtn}>
              {copied ? "Copied ✓" : "Copy MCP URL"}
            </button>

            <button
              onClick={save}
              disabled={!loaded || status === "saving" || status === "loading"}
              title={
                !loaded
                  ? "Context hasn't loaded — saving is disabled to protect your data."
                  : undefined
              }
              style={{
                background: "var(--marine)",
                border: "none",
                borderRadius: "var(--radius)",
                color: "var(--ground)",
                cursor: loaded ? "pointer" : "not-allowed",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                padding: "9px 22px",
                opacity: !loaded || status === "saving" ? 0.5 : 1,
              }}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: "28px 32px 64px", width: SHELL, margin: "0 auto" }}>
        {status === "loading" && (
          <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>
            Loading your context…
          </p>
        )}
        {status === "error" && (
          <p
            style={{
              color: "var(--danger)",
              fontSize: 14,
              marginBottom: 24,
              background: "var(--well)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
            }}
          >
            {errorMsg}
          </p>
        )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* About you */}
        <div style={s.section(ACCENT.user)}>
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
        <div style={s.section(ACCENT.identities)}>
          <p style={s.sectionTitle}>Claude Identities</p>
          {(ctx.claudeIdentities ?? []).map((ci, i) => (
            <ClaudeIdentityRow key={i} ci={ci}
              onChange={(updated) => updateClaudeId(i, updated)}
              onRemove={() => removeClaudeId(i)} />
          ))}
          <button onClick={addClaudeId} style={s.addBtn}>+ Add Claude identity</button>
        </div>

        {/* Facts */}
        <div style={s.section(ACCENT.facts)}>
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
        <div style={s.section(ACCENT.relationships)}>
          <p style={s.sectionTitle}>Relationships</p>
          <p style={s.sectionHint}>
            Personal and professional in one list. Add people with an ongoing or intended ongoing
            relationship — not everyone you&apos;ve emailed. Someone who is evidence in a situation
            rather than a connection belongs in facts. Leave pronouns blank when you don&apos;t
            know them; blank means ask, and a guess from the name is how it goes wrong.
            Nicknames go in their own field — not inside the name, which is the key everything
            else looks people up by.
          </p>
          {ctx.relationships.map((r, i) => (
            <RelRow key={i} rel={r}
              onChange={(updated) => updateRel(i, updated)}
              onRemove={() => removeRel(i)} />
          ))}
          <button onClick={addRel} style={s.addBtn}>+ Add person</button>
        </div>

        {/* MCP URL — a credential, not a field, so it gets the warm zone treatment. */}
        <div style={{
          padding: "16px 18px",
          background: "var(--walnut)",
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--radius-lg)",
        }}>
          <p style={{
            fontFamily: "var(--font-display), system-ui, sans-serif",
            fontSize: 12, fontWeight: 700, color: "var(--text)", margin: "0 0 8px",
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>Your MCP URL</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ fontSize: 12, color: "var(--marine)", flex: 1, minWidth: 0, wordBreak: "break-all" }}>{mcpUrl}</code>
            <button onClick={copy} style={{
              background: "var(--well)", border: "1px solid var(--line)",
              borderRadius: 6, color: "var(--marine)", cursor: "pointer", fontSize: 12, padding: "5px 10px", whiteSpace: "nowrap",
            }}>
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, margin: "8px 0 0 0" }}>
            Treat this like a password — anyone holding it can read your context. Add{" "}
            <code style={{ color: "var(--marine)" }}>&name=Coru</code> to mark that identity{" "}
            <code style={{ color: "var(--marine)" }}>self: true</code>.
          </p>
        </div>

        <LinkPanel onLinked={(t, merged) => {
          setAccount((a) => (a ? { ...a, contextToken: t } : a));
          const fresh = { ...EMPTY, ...merged };
          setCtx(fresh);
          setSavedSnapshot(JSON.stringify(fresh));
          setLoaded(true);
        }} />

        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <button onClick={logout}
            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12 }}>
            Log out
          </button>
        </div>

      </div>
      </main>
    </>
  );
}
