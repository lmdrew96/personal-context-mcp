export default function Home() {
  return (
    <main style={{ padding: "48px 32px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Personal Context MCP</h1>
      <p style={{ color: "rgba(247,245,250,0.5)", marginBottom: 32, lineHeight: 1.6 }}>
        Your personal Claude context server. Use your MCP URL in Cha(t)os to automatically inject your identity, projects, and preferences.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "rgba(247,245,250,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Endpoints</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <code style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            GET /context — returns your PersonalContext JSON
          </code>
          <code style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            POST /mcp — MCP over HTTP (JSON-RPC 2.0)
          </code>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "rgba(247,245,250,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Available Tools</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["pctx_get_context", "pctx_update_context", "pctx_add_project", "pctx_add_relationship"].map((t) => (
            <code key={t} style={{ background: "rgba(139,189,185,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8bbdb9" }}>
              {t}
            </code>
          ))}
        </div>
      </section>
    </main>
  );
}
