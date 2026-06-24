"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomBar } from "./_components/BottomBar";
import { TopBar } from "./_components/TopBar";

export default function HomePage() {
  const [name, setName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("volga-player-name");
    if (stored) setName(stored);
  }, []);

  function persistName(next: string) {
    setName(next);
    if (next.trim()) {
      localStorage.setItem("volga-player-name", next.trim());
    }
  }

  function openSettings() {
    window.location.href = "/lobby";
  }

  return (
    <div className="gf-app">
      <TopBar
        showBack={false}
        rightAction={{ label: "設定", icon: "⚙", onClick: openSettings }}
      />

      <main className="gf-main">
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            paddingTop: 12,
          }}
        >
          <div style={{ position: "relative", textAlign: "center" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 360,
                height: 360,
                transform: "translate(-50%, -55%)",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, #f9e07a 0%, #f0b04a 55%, transparent 70%)",
                filter: "blur(2px)",
                opacity: 0.85,
                zIndex: 0,
              }}
            />
            <h1 className="gf-title" style={{ position: "relative", zIndex: 1 }}>
              VOLGA FIELD
            </h1>
            <div
              className="gf-title-sub"
              style={{ position: "relative", zIndex: 1, marginTop: 6 }}
            >
              ヴォルガ
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              width: "min(320px, 90%)",
            }}
          >
            <label
              style={{
                color: "#b85a1f",
                fontSize: 13,
                letterSpacing: "0.1em",
                textShadow: "1px 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              預言者の名前
            </label>
            <input
              className="gf-input"
              value={name}
              onChange={(e) => persistName(e.target.value)}
              placeholder="ヴォルガ"
            />
          </div>

          <Link href="/lobby">
            <button className="gf-btn" disabled={!name.trim()}>
              生誕する
            </button>
          </Link>

          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            <AppBadge label="App Store" sub="からダウンロード" icon="" />
            <AppBadge label="Google Play" sub="で手に入れよう" icon="▶" />
          </div>
        </section>
      </main>

      <BottomBar />
    </div>
  );
}

function AppBadge({
  label,
  sub,
  icon,
}: {
  label: string;
  sub: string;
  icon: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#1f1f1f",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: 10,
        minWidth: 160,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon || " "}</span>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 14, fontWeight: 900 }}>{label}</span>
        <span style={{ fontSize: 10, opacity: 0.85 }}>{sub}</span>
      </div>
    </div>
  );
}
