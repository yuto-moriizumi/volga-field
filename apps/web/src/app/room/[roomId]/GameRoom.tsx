"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGameSocket } from "@/lib/useGameSocket";
import type { GameState, PlayerState } from "@volga/shared";
import { CardView } from "./CardView";
import { BattleLog } from "./BattleLog";

export function GameRoom({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { status, playerId, send, lastMessage } = useGameSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joinRequested, setJoinRequested] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("volga-player-name");
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    if (
      status === "connected" &&
      !gameState &&
      !joinRequested &&
      name.trim()
    ) {
      setJoinRequested(true);
      send({ type: "join_room", roomId, playerName: name.trim() });
    }
  }, [status, gameState, joinRequested, name, roomId, send]);

  useEffect(() => {
    if (!lastMessage) return;
    if (
      lastMessage.type === "room_joined" ||
      lastMessage.type === "game_started" ||
      lastMessage.type === "game_state"
    ) {
      setGameState(lastMessage.gameState);
      setError(null);
    }
    if (lastMessage.type === "error") {
      setError(lastMessage.message);
      setJoinRequested(false);
    }
  }, [lastMessage]);

  function submitName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("volga-player-name", trimmed);
    setJoinRequested(true);
    send({ type: "join_room", roomId, playerName: trimmed });
  }

  const me = useMemo<PlayerState | null>(() => {
    if (!gameState || !playerId) return null;
    return gameState.players.find((p) => p.id === playerId) ?? null;
  }, [gameState, playerId]);

  const opponent = useMemo<PlayerState | null>(() => {
    if (!gameState || !playerId) return null;
    return gameState.players.find((p) => p.id !== playerId) ?? null;
  }, [gameState, playerId]);

  const isMyTurn =
    gameState?.players[gameState.activePlayerIndex]?.id === playerId;

  function playCard(idx: number) {
    if (!me || !isMyTurn) return;
    const card = me.hand[idx];
    if (!card) return;
    setSelectedCardIdx(idx);
    send({ type: "play_card", cardRef: { id: card.id } });
  }

  function endTurn() {
    if (!isMyTurn) return;
    send({ type: "end_turn" });
  }

  function leaveRoom() {
    send({ type: "leave_room" });
    window.location.href = "/lobby";
  }

  function ready() {
    send({ type: "ready" });
  }

  if (!gameState) {
    const connecting = status !== "connected";
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>⚔️ Volga Field</h1>
        <div style={{ color: "var(--text-dim)" }}>
          ルームID: <code>{roomId}</code>
        </div>
        {connecting ? (
          <div>サーバに接続中... ({status})</div>
        ) : (
          <section
            style={{
              background: "var(--panel)",
              padding: 24,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 280,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>ルームに参加</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="あなたの名前"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitName();
              }}
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
              onClick={submitName}
              disabled={!name.trim() || joinRequested}
              style={{
                padding: "12px 24px",
                borderRadius: 4,
                background: "var(--accent)",
                color: "#000",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {joinRequested ? "参加中..." : "参加"}
            </button>
            {error && (
              <div
                style={{
                  padding: 8,
                  background: "var(--danger)",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
          </section>
        )}
      </main>
    );
  }

  const gameStarted = gameState.turn > 0 && gameState.players.length === 2 && gameState.players[0]!.hand.length > 0;
  const meReady = me?.ready ?? false;
  const oppReady = opponent?.ready ?? false;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 16,
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
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>ルーム: {roomId}</h1>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            ターン {gameState.turn} · 山札残り {gameState.deckSize}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 12,
              background:
                status === "connected" ? "var(--success)" : "var(--danger)",
            }}
          >
            {status}
          </span>
          <button
            onClick={leaveRoom}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              background: "var(--panel-light)",
              color: "var(--text)",
              fontSize: 12,
            }}
          >
            退出
          </button>
        </div>
      </header>

      {!gameStarted && (
        <section
          style={{
            background: "var(--panel)",
            padding: 24,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>対戦相手を待っています...</h2>
          <div style={{ display: "flex", gap: 24 }}>
            <PlayerSlot name={me?.name ?? "?"} ready={meReady} self />
            <PlayerSlot name={opponent?.name ?? "?"} ready={oppReady} />
          </div>
          <button
            onClick={ready}
            disabled={!opponent}
            style={{
              padding: "12px 24px",
              borderRadius: 4,
              background: meReady ? "var(--panel-light)" : "var(--accent)",
              color: meReady ? "var(--text)" : "#000",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {meReady ? "準備解除" : "準備完了"}
          </button>
        </section>
      )}

      {gameStarted && (
        <>
          <OpponentArea opponent={opponent} />
          <BattleArea
            isMyTurn={isMyTurn}
            gameState={gameState}
            onEndTurn={endTurn}
          />
          <MyArea
            me={me}
            isMyTurn={isMyTurn}
            selectedCardIdx={selectedCardIdx}
            onPlayCard={playCard}
          />
          <BattleLog entries={gameState.log} />
        </>
      )}

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: 12,
            background: "var(--danger)",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {gameState.winner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "var(--panel)",
              padding: 32,
              borderRadius: 12,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 32 }}>
              {gameState.winner === playerId
                ? "🏆 あなたの勝利!"
                : "💀 敗北..."}
            </h2>
            <button
              onClick={leaveRoom}
              style={{
                padding: "12px 24px",
                borderRadius: 4,
                background: "var(--accent)",
                color: "#000",
                fontWeight: 700,
              }}
            >
              ロビーに戻る
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function PlayerSlot({
  name,
  ready,
  self,
}: {
  name: string;
  ready: boolean;
  self?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--panel-light)",
        borderRadius: 8,
        minWidth: 120,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {name} {self && "(あなた)"}
      </div>
      <div
        style={{
          marginTop: 8,
          color: ready ? "var(--success)" : "var(--text-dim)",
        }}
      >
        {ready ? "✓ 準備完了" : "待機中"}
      </div>
    </div>
  );
}

function OpponentArea({ opponent }: { opponent: PlayerState | null }) {
  if (!opponent) return <div />;
  return (
    <section
      style={{
        background: "var(--panel)",
        padding: 16,
        borderRadius: 8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: "var(--text-dim)" }}>対戦相手</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{opponent.name}</div>
      </div>
      <HpBar hp={opponent.hp} maxHp={opponent.maxHp} />
      <EquipDisplay player={opponent} />
      <HandCount count={opponent.hand.length} />
    </section>
  );
}

function MyArea({
  me,
  isMyTurn,
  selectedCardIdx,
  onPlayCard,
}: {
  me: PlayerState | null;
  isMyTurn: boolean;
  selectedCardIdx: number | null;
  onPlayCard: (idx: number) => void;
}) {
  if (!me) return <div />;
  return (
    <section
      style={{
        background: "var(--panel)",
        padding: 16,
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
        <div>
          <div style={{ fontSize: 14, color: "var(--text-dim)" }}>あなた</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{me.name}</div>
        </div>
        <HpBar hp={me.hp} maxHp={me.maxHp} self />
        <EquipDisplay player={me} self />
        <HandCount count={me.hand.length} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {me.hand.map((card, idx) => (
          <CardView
            key={`${card.id}-${idx}`}
            cardRef={card}
            selected={selectedCardIdx === idx}
            playable={isMyTurn}
            onClick={() => onPlayCard(idx)}
          />
        ))}
      </div>
    </section>
  );
}

function BattleArea({
  isMyTurn,
  gameState,
  onEndTurn,
}: {
  isMyTurn: boolean;
  gameState: GameState;
  onEndTurn: () => void;
}) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  return (
    <section
      style={{
        background: "var(--panel)",
        padding: 16,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 16 }}>
        {gameState.winner
          ? "ゲーム終了"
          : isMyTurn
            ? "▶ あなたのターン"
            : `⏳ ${activePlayer?.name ?? "?"}のターン`}
      </div>
      <button
        onClick={onEndTurn}
        disabled={!isMyTurn || gameState.winner !== null}
        style={{
          padding: "12px 32px",
          borderRadius: 4,
          background: "var(--accent)",
          color: "#000",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        ターン終了
      </button>
    </section>
  );
}

function HpBar({
  hp,
  maxHp,
  self,
}: {
  hp: number;
  maxHp: number;
  self?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div style={{ minWidth: 200 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          marginBottom: 4,
        }}
      >
        HP {hp}/{maxHp}
      </div>
      <div
        style={{
          height: 16,
          background: "var(--bg)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: self ? "var(--success)" : "var(--danger)",
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function EquipDisplay({
  player,
  self,
}: {
  player: PlayerState;
  self?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 24 }}>
      <span title={player.equipped.weapon?.id ?? "武器なし"}>
        {player.equipped.weapon ? "⚔️" : "➖"}
      </span>
      <span title={player.equipped.shield?.id ?? "盾なし"}>
        {player.equipped.shield ? "🛡️" : "➖"}
      </span>
      {player.equipped.barrier && <span title="バリア">🔮</span>}
      {void self}
    </div>
  );
}

function HandCount({ count }: { count: number }) {
  return (
    <div
      style={{
        padding: "4px 12px",
        background: "var(--bg)",
        borderRadius: 12,
        fontSize: 14,
      }}
    >
      🃏 {count}枚
    </div>
  );
}