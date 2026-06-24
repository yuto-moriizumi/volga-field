"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGameSocket } from "@/lib/useGameSocket";
import { findCard } from "@volga/game-core";
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
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedDefenseIdx, setSelectedDefenseIdx] = useState<number | null>(null);
  const [hitFlash, setHitFlash] = useState<{ amount: number; key: number } | null>(null);
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
  const opponents = useMemo<PlayerState[]>(() => {
    if (!gameState || !playerId) return [];
    return gameState.players.filter((p) => p.id !== playerId);
  }, [gameState, playerId]);

  const isMyTurn =
    gameState?.players[gameState.activePlayerIndex]?.id === playerId;
  const isDefending = gameState?.phase === "defense" && gameState.pendingAttack?.defenderId === playerId;

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "game_state") return;
    const latest = lastMessage.gameState.log.at(-1);
    if (latest?.kind === "attack" && latest.damage) {
      setHitFlash({ amount: latest.damage, key: Date.now() });
    }
  }, [lastMessage]);

  function playCard(idx: number) {
    if (!me || !isMyTurn) return;
    const card = me.hand[idx];
    if (!card) return;
    setSelectedCardIdx(idx);
    setSelectedTargetId(isAttackCard(card.id) ? opponent?.id ?? null : null);
  }

  function executeSelectedCard() {
    if (!me || !isMyTurn || selectedCardIdx === null) return;
    const card = me.hand[selectedCardIdx];
    if (!card) return;
    send({
      type: "play_card",
      cardRef: { id: card.id },
      targetPlayerId: selectedTargetId ?? opponent?.id,
    });
    setSelectedCardIdx(null);
  }

  function defend(cardIdx?: number) {
    if (!me || !isDefending) return;
    const card = typeof cardIdx === "number" ? me.hand[cardIdx] : undefined;
    send({ type: "defend", cardRef: card ? { id: card.id } : undefined });
    setSelectedDefenseIdx(null);
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
    gameState.players.length >= 2 &&
    gameState.players[0]!.hand.length > 0;
  const displayedActionTurn = gameState.actionTurn ?? gameState.turn;
  const meReady = me?.ready ?? false;

  return (
    <div className={`gf-app${gameState.doomsdayActive ? " gf-doomsday-active" : ""}`}>
      <TopBar
        title={`G.F.${displayedActionTurn}`}
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
              {opponents.length > 0 ? (
                opponents.map((p) => <PlayerSlot key={p.id} name={p.name} ready={p.ready} />)
              ) : (
                <PlayerSlot name="?" ready={false} />
              )}
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
            <OpponentArea opponents={opponents} />
            <BattleBoard
              me={me}
              players={gameState.players}
              gameState={gameState}
              playerId={playerId}
              isMyTurn={isMyTurn}
              selectedCardIdx={selectedCardIdx}
              selectedTargetId={selectedTargetId}
              selectedDefenseIdx={selectedDefenseIdx}
              hitFlash={hitFlash}
              onSelectTarget={setSelectedTargetId}
              onExecute={executeSelectedCard}
              onPassDefense={() => defend()}
              onEndTurn={endTurn}
            />
            <MyArea
              me={me}
              isMyTurn={isMyTurn}
              isDefending={isDefending}
              selectedCardIdx={selectedCardIdx}
              selectedDefenseIdx={selectedDefenseIdx}
              onPlayCard={playCard}
              onSelectDefense={setSelectedDefenseIdx}
              onDefend={defend}
            />
            <BattleLog entries={gameState.log} />
          </>
        )}

        {error && <div className="gf-toast">{error}</div>}
      </main>

      <BottomBar playerName={(me?.name ?? name.trim()) || "ヴォルガ"}>
        {gameState.doomsdayTurn && (
          <span className="gf-tag">
            終末 {gameState.doomsdayActive ? "発生中" : `G.F.${gameState.doomsdayTurn}`}
          </span>
        )}
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

function OpponentArea({ opponents }: { opponents: PlayerState[] }) {
  if (opponents.length === 0) return <div />;
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
      {opponents.map((opponent) => (
        <div
          key={opponent.id}
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            flex: "1 1 280px",
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
        </div>
      ))}
    </section>
  );
}

function MyArea({
  me,
  isMyTurn,
  isDefending,
  selectedCardIdx,
  selectedDefenseIdx,
  onPlayCard,
  onSelectDefense,
  onDefend,
}: {
  me: PlayerState | null;
  isMyTurn: boolean;
  isDefending: boolean;
  selectedCardIdx: number | null;
  selectedDefenseIdx: number | null;
  onPlayCard: (idx: number) => void;
  onSelectDefense: (idx: number | null) => void;
  onDefend: (idx?: number) => void;
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
            selected={selectedCardIdx === idx || selectedDefenseIdx === idx}
            playable={isDefending ? isDefenseCard(card.id) : isMyTurn}
            onClick={() => {
              if (isDefending) {
                onSelectDefense(idx);
                onDefend(idx);
              } else {
                onPlayCard(idx);
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}

function BattleBoard({
  me,
  players,
  gameState,
  playerId,
  isMyTurn,
  selectedCardIdx,
  selectedTargetId,
  selectedDefenseIdx,
  hitFlash,
  onSelectTarget,
  onExecute,
  onPassDefense,
  onEndTurn,
}: {
  me: PlayerState | null;
  players: PlayerState[];
  gameState: GameState;
  playerId: string | null;
  isMyTurn: boolean;
  selectedCardIdx: number | null;
  selectedTargetId: string | null;
  selectedDefenseIdx: number | null;
  hitFlash: { amount: number; key: number } | null;
  onSelectTarget: (playerId: string) => void;
  onExecute: () => void;
  onPassDefense: () => void;
  onEndTurn: () => void;
}) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const selectedCard = selectedCardIdx !== null ? me?.hand[selectedCardIdx] : null;
  const defenseCard = selectedDefenseIdx !== null ? me?.hand[selectedDefenseIdx] : null;
  const pending = gameState.pendingAttack;
  const isDefending = gameState.phase === "defense" && pending?.defenderId === playerId;
  const leftCard = isDefending ? pending?.card : selectedCard;
  const actionLabel = isDefending
    ? defenseCard
      ? `${findCard(defenseCard.id)?.name ?? "防御"}で受ける`
      : "防御なしで受ける"
    : selectedCard
      ? "アクション実行"
      : isMyTurn
        ? "カードを選択"
        : "相手のターン";

  return (
    <section
      className="gf-card gf-battle-board"
      style={{
        minHeight: 270,
        padding: 16,
        alignItems: "stretch",
      }}
    >
      <button
        onClick={onExecute}
        disabled={!selectedCard || !isMyTurn || isDefending}
        style={{
          background: "var(--panel-cream-soft)",
          border: "3px solid var(--bar-teal)",
          borderRadius: 8,
          padding: 0,
          minHeight: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {leftCard ? (
          <LargeCard cardRef={leftCard} />
        ) : (
          <span style={{ color: "var(--text-dark-soft)" }}>カード</span>
        )}
      </button>

      <button
        onClick={isDefending ? onPassDefense : undefined}
        style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.08))",
          border: "none",
          borderRadius: 8,
          minHeight: 190,
          color: "var(--text-dark)",
          cursor: isDefending ? "pointer" : "default",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>
          {gameState.winner
            ? "ゲーム終了"
            : isDefending
              ? "防御カードを選択"
              : isMyTurn
                ? "あなたのターン"
                : `${activePlayer?.name ?? "?"}のターン`}
        </div>
        {hitFlash && (
          <div
            key={hitFlash.key}
            className="gf-hit-flash"
          >
            <strong>{hitFlash.amount}</strong>
            <span>ダメージ</span>
          </div>
        )}
        <div
          style={{
            width: "min(260px, 90%)",
            margin: "0 auto",
            padding: "8px 14px",
            borderRadius: 8,
            background: isDefending ? "#bd4646" : "#d9ffd0",
            border: "3px solid #4f5554",
            color: isDefending ? "#fff" : "var(--text-dark)",
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          {actionLabel}
        </div>
        <button
          className="gf-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEndTurn();
          }}
          disabled={!isMyTurn || gameState.winner !== null || isDefending}
          style={{ marginTop: 18 }}
        >
          ターン終了
        </button>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectTarget(p.id)}
            disabled={!isMyTurn || isDefending}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              border: `3px solid ${selectedTargetId === p.id ? "#ff6aa2" : "#b9aaa5"}`,
              background: "#f2f2ef",
              color: p.id === playerId ? "var(--bar-teal-dark)" : "#3f35d8",
              boxShadow: selectedTargetId === p.id ? "0 0 0 4px rgba(255,106,162,.22)" : "none",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 900 }}>{p.name}</span>
            <span style={{ color: "var(--text-dark)", fontSize: 18, fontWeight: 900 }}>
              HP {p.hp}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LargeCard({ cardRef }: { cardRef: { id: string } }) {
  const card = findCard(cardRef.id);
  if (!card) return null;
  const power = card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: "88px 1fr" }}>
      <div style={{ fontSize: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {card.emoji}
      </div>
      <div style={{ padding: 8, textAlign: "left" }}>
        <div style={{ fontSize: 20, borderBottom: "2px solid #8ccf80" }}>{card.name}</div>
        <div style={{ fontSize: 24, marginTop: 8 }}>
          {card.category === "shield" ? "守" : "攻"}
          {power ?? ""}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dark-soft)" }}>{card.description}</div>
      </div>
    </div>
  );
}

function isDefenseCard(cardId: string): boolean {
  return findCard(cardId)?.effects.some((effect) => effect.kind === "equip_shield") ?? false;
}

function isAttackCard(cardId: string): boolean {
  return (
    findCard(cardId)?.effects.some(
      (effect) => effect.kind === "damage" && effect.target === "opponent",
    ) ?? false
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
