"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DoomsdayTurn, TrainingPlayerCount } from "@volga/shared";
import { useGameSocket } from "@/lib/useGameSocket";
import { BottomBar } from "../_components/BottomBar";
import { TopBar } from "../_components/TopBar";

type ModeId = "shugyo" | "kakure" | "shinken";
const DOOMSDAY_OPTIONS: (DoomsdayTurn | null)[] = [null, 50, 75, 100];
const TRAINING_PLAYER_COUNTS: TrainingPlayerCount[] = [2, 3, 4, 5, 6, 7, 8, 9];

const MODES: {
  id: ModeId;
  title: string;
  subtitle: string;
  tone: "tone-lavender" | "tone-teal" | "tone-pink";
}[] = [
  {
    id: "shugyo",
    title: "修行",
    subtitle: "コンピュータと対戦",
    tone: "tone-lavender",
  },
  {
    id: "kakure",
    title: "隠れ乱闘",
    subtitle: "友達と対戦",
    tone: "tone-teal",
  },
  {
    id: "shinken",
    title: "真剣タイマン",
    subtitle: "2人個人戦",
    tone: "tone-pink",
  },
];

export function Lobby() {
  const router = useRouter();
  const { status, send, lastMessage } = useGameSocket();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hostMode, setHostMode] = useState<ModeId | null>(null);
  const [hostPassword, setHostPassword] = useState("");
  const [doomsdayTurn, setDoomsdayTurn] = useState<DoomsdayTurn | null>(50);
  const [trainingPlayerCount, setTrainingPlayerCount] = useState<TrainingPlayerCount>(2);
  const [showTrainingSettings, setShowTrainingSettings] = useState(false);
  const [prophetCount, setProphetCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("volga-player-name");
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "error") {
      setError(lastMessage.message);
      setHostMode(null);
      setShowTrainingSettings(false);
    }
    if (lastMessage.type === "room_created") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.roomId}`);
    }
    if (lastMessage.type === "room_joined") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.gameState.roomId}`);
    }
    if (lastMessage.type === "rooms_list") {
      setProphetCount(lastMessage.playerCount);
    }
  }, [lastMessage, router, name]);

  useEffect(() => {
    if (status !== "connected") return;
    send({ type: "list_rooms" });
    const intervalId = window.setInterval(() => {
      send({ type: "list_rooms" });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [send, status]);

  function startHost(mode: ModeId) {
    setError(null);
    if (!name.trim()) {
      setError("預言者の名前を入力してください");
      return;
    }
    if (mode === "shugyo") {
      setShowTrainingSettings(true);
      setHostMode(null);
      return;
    }
    if (mode === "shinken") {
      localStorage.setItem("volga-player-name", name.trim());
      localStorage.removeItem("volga-room-password");
      send({
        type: "create_room",
        playerName: name.trim(),
        mode: "versus",
      });
    } else {
      setHostMode(mode);
      setHostPassword("");
    }
  }

  function startTraining() {
    setError(null);
    if (!name.trim()) {
      setError("預言者の名前を入力してください");
      return;
    }
    localStorage.setItem("volga-player-name", name.trim());
    localStorage.removeItem("volga-room-password");
    send({
      type: "create_room",
      playerName: name.trim(),
      mode: "training",
      doomsdayTurn,
      trainingPlayerCount,
    });
  }

  function confirmHost() {
    if (!hostMode) return;
    const trimmedPassword = hostPassword.trim();
    if (!trimmedPassword) {
      setError("部屋の合言葉を入力してください");
      return;
    }
    localStorage.setItem("volga-player-name", name.trim());
    localStorage.setItem(
      "volga-room-password",
      JSON.stringify({ mode: hostMode, password: trimmedPassword }),
    );
    send({
      type: "create_room",
      roomId: trimmedPassword,
      playerName: name.trim(),
      doomsdayTurn,
    });
  }

  return (
    <div className="gf-app">
      <TopBar showBack={false} />

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
              <div className="count">
                預言者 {getProphetCount(m.id, prophetCount).toLocaleString()} 人
              </div>
              <div className="foot">{m.subtitle}</div>
            </button>
          ))}
        </div>

        {showTrainingSettings && (
          <section className="gf-card gf-doomsday-picker">
            <div className="gf-section-title">修行の設定</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-dark-soft)" }}>
              修行者の人数
            </div>
            <div className="gf-segmented" role="group" aria-label="修行者の人数">
              {TRAINING_PLAYER_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={count === trainingPlayerCount ? "active" : ""}
                  onClick={() => setTrainingPlayerCount(count)}
                >
                  {count}人
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-dark-soft)" }}>
              終末の時
            </div>
            <DoomsdayPicker value={doomsdayTurn} onChange={setDoomsdayTurn} />
            <button className="gf-btn" onClick={startTraining} disabled={status !== "connected"}>
              戦いを始める
            </button>
          </section>
        )}

        {!showTrainingSettings && (
          <section className="gf-card gf-doomsday-picker">
            <div className="gf-section-title">終末の時</div>
            <DoomsdayPicker value={doomsdayTurn} onChange={setDoomsdayTurn} />
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
              仲間と同じ合言葉を入力してください
            </p>
            <DoomsdayPicker value={doomsdayTurn} onChange={setDoomsdayTurn} />
            <input
              className="gf-input"
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              placeholder="部屋の合言葉"
              style={{ fontSize: 18, textAlign: "center", letterSpacing: "0.2em" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmHost();
              }}
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

function DoomsdayPicker({
  value,
  onChange,
}: {
  value: DoomsdayTurn | null;
  onChange: (turn: DoomsdayTurn | null) => void;
}) {
  return (
    <div className="gf-segmented" role="group" aria-label="終末の時">
      {DOOMSDAY_OPTIONS.map((turn) => (
        <button
          key={turn ?? "none"}
          type="button"
          className={turn === value ? "active" : ""}
          onClick={() => onChange(turn)}
        >
          {turn === null ? "なし" : `G.F.${turn}`}
        </button>
      ))}
    </div>
  );
}
function getProphetCount(mode: ModeId, roomPlayerCount: number): number {
  if (mode === "kakure") return roomPlayerCount;
  return 0;
}
