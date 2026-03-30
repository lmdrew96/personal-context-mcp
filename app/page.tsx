"use client";

import { useState } from "react";

const BASE_URL = "https://personal-context-mcp.vercel.app";

export default function Home() {
  const [token, setToken] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = () => {
    setToken(crypto.randomUUID());
    setGenerated(true);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const mcpUrl = `${BASE_URL}/mcp?token=${token}`;
  const contextUrl = `${BASE_URL}/context?token=${token}`;

  return (
    <main style={{ padding: "48px 32px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Personal Context MCP</h1>
      <p style={{ color: "rgba(247,245,250,0.5)", marginBottom: 32, lineHeight: 1.6 }}>
        Bring your personal context into Cha(t)os. Generate a token to get your private URLs.
      </p>

      {!generated ? (
        <button
          onClick={generate}
          style={{
            background: "#DFA649",
            color: "#0f0f11",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Generate my personal URLs →
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ padding: "16px", background: "rgba(223,166,73,0.08)", border: "1px solid rgba(223,166,73,0.2)", borderRadius: 12 }}>
            <p style={{ fontSize: 12, color: "rgba(247,245,250,0.4)", marginBottom: 6 }}>Your token — save this somewhere safe</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ fontSize: 13, color: "#DFA649", flex: 1, wordBreak: "break-all" }}>{token}</code>
              <button onClick={() => copy(token, "token")} style={copyBtn}>
                {copied === "token" ? "✓" : "Copy"}
              </button>
            </div>
          </div>

          <URLRow label="MCP URL (paste into Cha(t)os or Claude Desktop)" url={mcpUrl} onCopy={() => copy(mcpUrl, "mcp")} copied={copied === "mcp"} />
          <URLRow label="Context URL (for reference)" url={contextUrl} onCopy={() => copy(contextUrl, "ctx")} copied={copied === "ctx"} />

          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "rgba(247,245,250,0.4)", lineHeight: 1.7 }}>
              <strong style={{ color: "rgba(247,245,250,0.7)" }}>Next:</strong> Add your MCP URL to Claude Desktop, then ask Claude to run{" "}
              <code style={{ color: "#8CBDB9", fontSize: 12 }}>pctx_update_context</code>,{" "}
              <code style={{ color: "#8CBDB9", fontSize: 12 }}>pctx_add_project</code>, and{" "}
              <code style={{ color: "#8CBDB9", fontSize: 12 }}>pctx_add_relationship</code> to fill in your context.
            </p>
          </div>
        </div>
      )}

      <div style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "rgba(247,245,250,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Tools</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["pctx_get_context", "pctx_update_context", "pctx_add_project", "pctx_add_relationship"].map((t) => (
            <code key={t} style={{ background: "rgba(139,189,185,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8bbdb9" }}>
              {t}
            </code>
          ))}
        </div>
      </div>
    </main>
  );
}

const copyBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "rgba(247,245,250,0.6)",
  fontSize: 12,
  padding: "4px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function URLRow({ label, url, onCopy, copied }: { label: string; url: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontSize: 12, color: "rgba(247,245,250,0.4)", margin: 0 }}>{label}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px" }}>
        <code style={{ fontSize: 12, color: "rgba(247,245,250,0.7)", flex: 1, wordBreak: "break-all" }}>{url}</code>
        <button onClick={onCopy} style={copyBtn}>{copied ? "✓" : "Copy"}</button>
      </div>
    </div>
  );
}
