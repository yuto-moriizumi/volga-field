"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/lib/useGameSocket";
import { BottomBar } from "../_components/BottomBar";
import { TopBar } from "../_components/TopBar";

type ModeId = "shugyo" | "kakure" | "shinken";

const MODES: {
  id: ModeId;
  title: string;
  subtitle: string;
  tone: "tone-lavender" | "tone-teal" | "tone-pink";
  players: number;
}[] = [
  {
    id: "shugyo",
    title: "修行",
    subtitle: "コンピュータと対戦",
    tone: "tone-lavender",
    players: 274,
  },
  {
    id: "kakure",
    title: "隠れ乱闘",
    subtitle: "友達と対戦",
    tone: "tone-teal",
    players: 850,
  },
  {
    id: "shinken",
    title: "真剣タイマン",
    subtitle: "2人個人戦",
    tone: "tone-pink",
    players: 1734,
  },
];

export function Lobby() {
  const router = useRouter();
  const { status, send, lastMessage } = useGameSocket();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hostMode, setHostMode] = useState<ModeId | null>(null);
  const [hostPassword, setHostPassword] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("volga-player-name");
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "error") {
      setError(lastMessage.message);
      setHostMode(null);
    }
    if (lastMessage.type === "room_created") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.roomId}`);
    }
    if (lastMessage.type === "room_joined") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.gameState.roomId}`);
    }
  }, [lastMessage, router, name]);

  function startHost(mode: ModeId) {
    setError(null);
    if (!name.trim()) {
      setError("預言者の名前を入力してください");
      return;
    }
    if (mode === "shinken") {
      localStorage.setItem("volga-player-name", name.trim());
      send({ type: "create_room", playerName: name.trim() });
    } else {
      setHostMode(mode);
      setHostPassword(generatePassword());
    }
  }

  function confirmHost() {
    if (!hostMode) return;
    localStorage.setItem("volga-player-name", name.trim());
    localStorage.setItem(
      "volga-room-password",
      JSON.stringify({ mode: hostMode, password: hostPassword }),
    );
    send({ type: "create_room", playerName: name.trim() });
  }

  function joinWithPassword() {
    setError(null);
    if (!name.trim()) {
      setError("預言者の名前を入力してください");
      return;
    }
    if (!joinRoomId.trim()) {
      setError("部屋の合言葉を入力してください");
      return;
    }
    localStorage.setItem("volga-player-name", name.trim());
    send({ type: "join_room", roomId: joinRoomId.trim(), playerName: name.trim() });
  }

  return (
    <div className="gf-app">
      <TopBar
        showBack={false}
        rightAction={{
          label: "合言葉",
          icon: "🔑",
          onClick: () => setShowJoin((v) => !v),
        }}
      />

      <main
        className="gf-main"
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            alignItems: "center",
            width: "100%",
          }}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`gf-card gf-mode-card ${m.tone}`}
              onClick={() => startHost(m.id)}
              disabled={status !== "connected"}
            >
              <div className="head">{m.title}</div>
              <div className="count">預言者 {m.players.toLocaleString()} 人</div>
              <div className="foot">{m.subtitle}</div>
            </button>
          ))}
        </div>

        {showJoin && (
          <section
            className="gf-card"
            style={{
              padding: 18,
              width: "min(420px, 92%)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div className="gf-section-title">合言葉で合流する</div>
            <input
              className="gf-input"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="部屋の合言葉"
              onKeyDown={(e) => {
                if (e.key === "Enter") joinWithPassword();
              }}
            />
            <button className="gf-btn" onClick={joinWithPassword}>
              唱える
            </button>
          </section>
        )}

        {error && <div className="gf-toast">{error}</div>}
      </main>

      {hostMode && (
        <div className="gf-modal-backdrop" onClick={() => setHostMode(null)}>
          <div className="gf-modal" onClick={(e) => e.stopPropagation()}>
            <h3>部屋の合言葉</h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--text-dark-soft)",
              }}
            >
              以下の合言葉を仲間に伝えてください
            </p>
            <input
              className="gf-input"
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              style={{ fontSize: 18, textAlign: "center", letterSpacing: "0.2em" }}
            />
            <button className="gf-btn" onClick={confirmHost}>
              唱える
            </button>
          </div>
        </div>
      )}

      <BottomBar playerName={name.trim() || "ヴォルガ"} />
    </div>
  );
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
