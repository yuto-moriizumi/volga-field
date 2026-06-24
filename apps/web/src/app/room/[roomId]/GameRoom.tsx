"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGameSocket } from "@/lib/useGameSocket";
import type { GameState, PlayerState } from "@volga/shared";
import { BottomBar } from "../../_components/BottomBar";
import { TopBar } from "../../_components/TopBar";
import { BattleLog } from "./BattleLog";
import { CardView } from "./CardView";

export function GameRoom({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { status, playerId, gameState: ctxGameState, send, lastMessage } = useGameSocket();
  const [gameState, setGameState] = useState<GameState | null>(() => {
    if (ctxGameState && ctxGameState.roomId === roomId) {
      return ctxGameState;
    }
    return null;
  });
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joinRequested, setJoinRequested] = useState(
    ctxGameState?.roomId === roomId && !!playerId,
  );

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
      <div className="gf-app">
        <TopBar showBack={false} />
        <main
          className="gf-main"
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <h1
            className="gf-title"
            style={{ fontSize: 44, WebkitTextStroke: "1.5px #4a2810" }}
          >
            Volga Field
          </h1>
          <div
            style={{
              color: "var(--text-dark-soft)",
              background: "var(--panel-cream)",
              border: "2px solid var(--line-teal)",
              borderRadius: 12,
              padding: "6px 14px",
            }}
          >
            部屋: <code style={{ fontWeight: 900 }}>{roomId}</code>
          </div>
          {connecting ? (
            <div style={{ color: "var(--text-dark-soft)" }}>
              サーバに接続中... ({status})
            </div>
          ) : (
            <section
              className="gf-card"
              style={{
                padding: 20,
                width: "min(360px, 92%)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div className="gf-section-title">預言者の合流</div>
              <input
                className="gf-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="あなたの名前"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitName();
                }}
              />
              <button
                className="gf-btn"
                onClick={submitName}
                disabled={!name.trim() || joinRequested}
              >
                {joinRequested ? "合流中…" : "唱える"}
              </button>
            </section>
          )}
          {error && <div className="gf-toast">{error}</div>}
        </main>
        <BottomBar playerName={name.trim() || "ヴォルガ"} />
      </div>
    );
  }

  const gameStarted =
    gameState.turn > 0 &&
    gameState.players.length === 2 &&
    gameState.players[0]!.hand.length > 0;
  const meReady = me?.ready ?? false;
  const oppReady = opponent?.ready ?? false;

  return (
    <div className="gf-app">
      <TopBar
        title={`ターン ${gameState.turn}`}
        rightAction={{ label: "退出", icon: "🚪", onClick: leaveRoom }}
      />

      <main
        className="gf-main"
        style={{ gap: 14 }}
      >
        {!gameStarted && (
          <section
            className="gf-card"
            style={{
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div className="gf-section-title">対戦相手を待っています…</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
              <PlayerSlot name={me?.name ?? "?"} ready={meReady} self />
              <PlayerSlot name={opponent?.name ?? "?"} ready={oppReady} />
            </div>
            <button
              className="gf-btn"
              onClick={ready}
              disabled={!opponent}
              style={{
                background: meReady
                  ? "linear-gradient(180deg, #b8b4d4, #908cb6)"
                  : undefined,
                color: meReady ? "#2c2745" : undefined,
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

        {error && <div className="gf-toast">{error}</div>}
      </main>

      <BottomBar playerName={(me?.name ?? name.trim()) || "ヴォルガ"}>
        <span className="gf-tag">山札 {gameState.deckSize}</span>
      </BottomBar>

      {gameState.winner && (
        <div className="gf-modal-backdrop">
          <div className="gf-modal" style={{ alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>
              {gameState.winner === playerId ? "" : "💀"}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 26,
                color: "var(--bar-teal-dark)",
              }}
            >
              {gameState.winner === playerId ? "あなたの勝利!" : "敗北…"}
            </h2>
            <button className="gf-btn" onClick={leaveRoom}>
              戻る
            </button>
          </div>
        </div>
      )}
    </div>
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
      className="gf-card-soft"
      style={{
        padding: 16,
        minWidth: 140,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>
        {name} {self && <span style={{ fontSize: 12 }}>(あなた)</span>}
      </div>
      <div
        style={{
          marginTop: 6,
          color: ready ? "var(--success)" : "var(--text-dark-soft)",
          fontWeight: 900,
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
      className="gf-card"
      style={{
        padding: 14,
        display: "flex",
        gap: 14,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "0 0 auto" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dark-soft)",
            fontWeight: 900,
          }}
        >
          対戦相手
        </div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{opponent.name}</div>
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
      className="gf-card"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dark-soft)",
              fontWeight: 900,
            }}
          >
            あなた
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{me.name}</div>
        </div>
        <HpBar hp={me.hp} maxHp={me.maxHp} self />
        <EquipDisplay player={me} self />
        <HandCount count={me.hand.length} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "8px 4px 0",
        }}
      >
        {me.hand.length === 0 && (
          <div style={{ color: "var(--text-dark-soft)", fontWeight: 900 }}>
            手札がない…
          </div>
        )}
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
      className="gf-card"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: isMyTurn ? "var(--bar-teal-dark)" : "var(--text-dark-soft)",
        }}
      >
        {gameState.winner
          ? "ゲーム終了"
          : isMyTurn
            ? "あなたのターン"
            : `${activePlayer?.name ?? "?"}のターン`}
      </div>
      <button
        className="gf-btn"
        onClick={onEndTurn}
        disabled={!isMyTurn || gameState.winner !== null}
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
    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dark-soft)",
          marginBottom: 4,
          fontWeight: 900,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>HP</span>
        <span>
          {hp}/{maxHp}
        </span>
      </div>
      <div
        style={{
          height: 18,
          background: "#1f5b50",
          borderRadius: 10,
          overflow: "hidden",
          border: "2px solid #1f5b50",
          boxShadow: "inset 0 2px 0 rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: self
              ? "linear-gradient(180deg, #8fd49a, #4ca05a)"
              : "linear-gradient(180deg, #f29180, #d04a36)",
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
    <div
      className="gf-card-soft"
      style={{
        padding: "6px 10px",
        display: "flex",
        gap: 10,
        fontSize: 22,
        alignItems: "center",
      }}
    >
      <span title={player.equipped.weapon?.id ?? "武器なし"}>
        {player.equipped.weapon ? "⚔" : "—"}
        <span style={{ fontSize: 11, marginLeft: 2 }}>
          {player.equipped.weapon?.power ?? 0}
        </span>
      </span>
      <span title={player.equipped.shield?.id ?? "盾なし"}>
        {player.equipped.shield ? "🛡" : "—"}
        <span style={{ fontSize: 11, marginLeft: 2 }}>
          {player.equipped.shield?.power ?? 0}
        </span>
      </span>
      {player.equipped.barrier && <span title="バリア">✦</span>}
      {void self}
    </div>
  );
}

function HandCount({ count }: { count: number }) {
  return (
    <div
      className="gf-card-soft"
      style={{
        padding: "6px 12px",
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 18 }}>✋</span>
      <span style={{ fontWeight: 900 }}>{count}枚</span>
    </div>
  );
}
