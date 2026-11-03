"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  DEFAULT_PLAYER_NAME,
  storePlayerName,
  useStoredPlayerName,
} from "@/lib/useStoredPlayerName";
import { BottomBar } from "./_components/BottomBar";
import { TopBar } from "./_components/TopBar";

export default function HomePage() {
  const router = useRouter();
  const { name, setName } = useStoredPlayerName();

  function persistName(next: string) {
    setName(next);
    if (next.trim()) storePlayerName(next.trim());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 送信時に DOM の値を読む。ブラウザのオートフィルは onChange を発火せずに
    // 値を差し込むことがあり、React の state だけを見ると名前が空のままになる。
    const field = new FormData(event.currentTarget).get("playerName");
    const trimmed = String(field ?? name).trim() || DEFAULT_PLAYER_NAME;
    setName(trimmed);
    storePlayerName(trimmed);
    router.push("/lobby");
  }

  return (
    <div className="gf-app">
      <TopBar showBack={false} />

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
                pointerEvents: "none",
              }}
            />
            <h1 className="gf-title" style={{ position: "relative", zIndex: 1 }}>
              VOLGA FIELD
            </h1>
          </div>

          {/* `display: contents` keeps the input group and the button as direct
              children of the flex column, so the layout is unchanged, while the
              form still submits on Enter. */}
          <form onSubmit={handleSubmit} style={{ display: "contents" }}>
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: "min(320px, 90%)",
              }}
            >
              <label
                htmlFor="player-name"
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
                id="player-name"
                name="playerName"
                className="gf-input"
                value={name}
                onChange={(e) => persistName(e.target.value)}
                placeholder={DEFAULT_PLAYER_NAME}
                autoComplete="off"
              />
            </div>

            <button type="submit" className="gf-btn">
              生誕する
            </button>
          </form>
        </section>
      </main>

      <BottomBar playerName={name.trim() || DEFAULT_PLAYER_NAME} />
    </div>
  );
}
