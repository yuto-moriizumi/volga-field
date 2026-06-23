import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 64,
          margin: 0,
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        ⚔️ Volga Field
      </h1>
      <p style={{ color: "var(--text-dim)", margin: 0 }}>
        ゴッドフィールド風のターン制カードバトルRPG
      </p>
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <Link href="/lobby">
          <button
            style={{
              padding: "16px 32px",
              fontSize: 18,
              borderRadius: 8,
              background: "var(--accent)",
              color: "#000",
              fontWeight: 700,
            }}
          >
            ロビーへ
          </button>
        </Link>
      </div>
    </main>
  );
}