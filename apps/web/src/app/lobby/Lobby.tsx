"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/lib/useGameSocket";

export function Lobby() {
  const router = useRouter();
  const { status, send, lastMessage } = useGameSocket();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [rooms, setRooms] = useState<
    {
      id: string;
      hostName: string;
      playerCount: number;
      maxPlayers: number;
      status: string;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("volga-player-name");
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    if (lastMessage?.type === "rooms_list") {
      setRooms(lastMessage.rooms);
    }
    if (lastMessage?.type === "error") {
      setError(lastMessage.message);
    }
    if (lastMessage?.type === "room_created") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.roomId}`);
    }
    if (lastMessage?.type === "room_joined") {
      localStorage.setItem("volga-player-name", name.trim());
      router.push(`/room/${lastMessage.gameState.roomId}`);
    }
  }, [lastMessage, router, name]);

  function createRoom() {
    setError(null);
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    localStorage.setItem("volga-player-name", name.trim());
    send({ type: "create_room", playerName: name.trim() });
  }

  function joinRoom(roomId: string) {
    setError(null);
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    localStorage.setItem("volga-player-name", name.trim());
    send({ type: "join_room", roomId, playerName: name.trim() });
  }

  function refreshRooms() {
    send({ type: "list_rooms" });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 24,
        gap: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>ロビー</h1>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 12,
            fontSize: 12,
            background:
              status === "connected"
                ? "var(--success)"
                : status === "connecting"
                  ? "var(--accent)"
                  : "var(--danger)",
          }}
        >
          {status === "connected"
            ? "接続中"
            : status === "connecting"
              ? "接続中..."
              : "切断"}
        </span>
      </header>

      <section
        style={{
          background: "var(--panel)",
          padding: 24,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>プレイヤー名</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="あなたの名前"
          style={{
            padding: "8px 12px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 16,
          }}
        />
        <button
          onClick={createRoom}
          disabled={status !== "connected"}
          style={{
            padding: "12px 24px",
            borderRadius: 4,
            background: "var(--accent)",
            color: "#000",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          ルームを作成
        </button>
      </section>

      <section
        style={{
          background: "var(--panel)",
          padding: 24,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>ルーム参加</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="ルームID"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 16,
            }}
          />
          <button
            onClick={() => joinRoom(joinRoomId)}
            disabled={status !== "connected" || !joinRoomId.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              background: "var(--accent)",
              color: "#000",
              fontWeight: 700,
            }}
          >
            参加
          </button>
        </div>
      </section>

      <section
        style={{
          background: "var(--panel)",
          padding: 24,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>オープンルーム</h2>
          <button
            onClick={refreshRooms}
            disabled={status !== "connected"}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              background: "var(--panel-light)",
              color: "var(--text)",
              fontSize: 12,
            }}
          >
            更新
          </button>
        </div>
        {rooms.length === 0 && (
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            まだオープンなルームがありません
          </p>
        )}
        {rooms.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 12,
              background: "var(--panel-light)",
              borderRadius: 4,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{r.hostName}のルーム</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {r.id} · {r.playerCount}/{r.maxPlayers}
              </div>
            </div>
            <button
              onClick={() => joinRoom(r.id)}
              disabled={status !== "connected" || r.playerCount >= r.maxPlayers}
              style={{
                padding: "8px 16px",
                borderRadius: 4,
                background: "var(--accent)",
                color: "#000",
                fontWeight: 700,
              }}
            >
              参加
            </button>
          </div>
        ))}
      </section>

      {error && (
        <div
          style={{
            padding: 12,
            background: "var(--danger)",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}