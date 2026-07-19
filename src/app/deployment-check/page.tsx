export const dynamic = "force-static";

export default function DeploymentCheckPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f5f7", color: "#131e35" }}>
      <section style={{ width: "min(720px, 100%)", background: "white", borderRadius: 24, padding: 32, boxShadow: "0 18px 50px rgba(19,30,53,0.12)" }}>
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".12em", color: "#137a3a" }}>DEPLOYMENT ACTIVE</p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(2rem, 6vw, 4rem)", lineHeight: 1 }}>ScholarOS is running.</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>This production build was triggered from the connected saga0003 GitHub identity. The old hemasagar333 preview deployment is not required for testing.</p>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 24 }}>
          <div style={{ padding: 16, borderRadius: 16, background: "#f4f5f7" }}><dt style={{ fontSize: 13, opacity: .7 }}>Release</dt><dd style={{ margin: "5px 0 0", fontWeight: 800 }}>ScholarOS V5.1</dd></div>
          <div style={{ padding: 16, borderRadius: 16, background: "#f4f5f7" }}><dt style={{ fontSize: 13, opacity: .7 }}>Branch</dt><dd style={{ margin: "5px 0 0", fontWeight: 800 }}>main</dd></div>
          <div style={{ padding: 16, borderRadius: 16, background: "#f4f5f7" }}><dt style={{ fontSize: 13, opacity: .7 }}>Owner</dt><dd style={{ margin: "5px 0 0", fontWeight: 800 }}>saga0003</dd></div>
        </dl>
      </section>
    </main>
  );
}
