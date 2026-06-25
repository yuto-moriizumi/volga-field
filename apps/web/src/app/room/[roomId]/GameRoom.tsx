"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGameSocket } from "@/lib/useGameSocket";
import { findCard } from "@volga/game-core";
import type { CardRef, GameState, PlayerState } from "@volga/shared";
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
  const [selectedDefenseIdxes, setSelectedDefenseIdxes] = useState<number[]>([]);
  const [lastHoveredCard, setLastHoveredCard] = useState<CardRef | null>(null);
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
  const canAct = Boolean(isMyTurn && gameState?.phase !== "defense" && !gameState.winner);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "game_state") return;
    const latest = lastMessage.gameState.log.at(-1);
    if (latest?.kind === "attack" && latest.damage) {
      setHitFlash({ amount: latest.damage, key: Date.now() });
    }
  }, [lastMessage]);

  function playCard(idx: number) {
    if (!me || !canAct) return;
    const card = playableCards(me)[idx];
    if (!card) return;
    const nextSelectedIdx = selectedCardIdx === idx ? null : idx;
    setSelectedCardIdx(nextSelectedIdx);
    setSelectedTargetId(
      nextSelectedIdx !== null ? (defaultTargetId(card.id, me.id, opponent?.id ?? null) ?? null) : null,
    );
  }

  function executeSelectedCard() {
    if (!me || !canAct || selectedCardIdx === null) return;
    const card = playableCards(me)[selectedCardIdx];
    if (!card) return;
    send({
      type: "play_card",
      cardRef: { id: card.id },
      targetPlayerId: selectedTargetId ?? defaultTargetId(card.id, me.id, opponent?.id ?? null),
    });
    setSelectedCardIdx(null);
  }

  function defend(cardIdxes: number[] = []) {
    if (!me || !isDefending) return;
    const cardRefs = cardIdxes
      .map((idx) => me.hand[idx])
      .filter((card): card is { id: string } => Boolean(card))
      .map((card) => ({ id: card.id }));
    send({ type: "defend", cardRefs });
    setSelectedDefenseIdxes([]);
  }

  function endTurn() {
    if (!canAct) return;
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
        className={`gf-main${gameStarted ? " gf-battle-main" : ""}`}
        style={gameStarted ? undefined : { gap: 14 }}
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
            <BattleBoard
              me={me}
              players={gameState.players}
              gameState={gameState}
              playerId={playerId}
              canAct={canAct}
              selectedCardIdx={selectedCardIdx}
              selectedTargetId={selectedTargetId}
              selectedDefenseIdxes={selectedDefenseIdxes}
              hitFlash={hitFlash}
              onSelectTarget={setSelectedTargetId}
              onExecute={executeSelectedCard}
              onPassDefense={() => defend(selectedDefenseIdxes)}
              onEndTurn={endTurn}
            />
            <MyArea
              me={me}
              canAct={canAct}
              isDefending={isDefending}
              selectedCardIdx={selectedCardIdx}
              selectedDefenseIdxes={selectedDefenseIdxes}
              onPlayCard={playCard}
              onHoverCard={setLastHoveredCard}
              onSelectDefense={(idx) =>
                setSelectedDefenseIdxes((current) =>
                  current.includes(idx)
                    ? current.filter((selectedIdx) => selectedIdx !== idx)
                    : [...current, idx],
                )
              }
            />
            <div className="gf-battle-log-dock">
              <BattleLog entries={gameState.log} />
            </div>
            {lastHoveredCard && (
              <aside className="gf-hover-card-preview" aria-label="最後にホバーしたカード">
                <LargeCard cardRef={lastHoveredCard} />
              </aside>
            )}
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

function MyArea({
  me,
  canAct,
  isDefending,
  selectedCardIdx,
  selectedDefenseIdxes,
  onPlayCard,
  onHoverCard,
  onSelectDefense,
}: {
  me: PlayerState | null;
  canAct: boolean;
  isDefending: boolean;
  selectedCardIdx: number | null;
  selectedDefenseIdxes: number[];
  onPlayCard: (idx: number) => void;
  onHoverCard: (card: CardRef) => void;
  onSelectDefense: (idx: number) => void;
}) {
  if (!me) return <div />;
  const cards = playableCards(me);
  return (
    <section className="gf-hand-dock" aria-label="手札">
      <div className="gf-hand-strip">
        {cards.length === 0 && (
          <div className="gf-empty-hand">
            手札がない…
          </div>
        )}
        {cards.map((card, idx) => {
          const definition = findCard(card.id);
          const isLearned = idx >= me.hand.length;
          const hasEnoughMp = !definition?.mpCost || me.mp >= definition.mpCost;
          const canPlayCard = canAct && hasEnoughMp && !isDefenseOnlyCard(card.id);
          return (
          <CardView
            key={`${card.id}-${idx}`}
            cardRef={card}
            selected={selectedCardIdx === idx || selectedDefenseIdxes.includes(idx)}
            playable={isDefending ? !isLearned && isDefenseCard(card.id) : canPlayCard}
            learned={isLearned}
            onHover={() => onHoverCard(card)}
            onClick={() => {
              if (isDefending) {
                if (!isLearned) onSelectDefense(idx);
              } else if (canPlayCard) {
                onPlayCard(idx);
              }
            }}
          />
          );
        })}
      </div>
    </section>
  );
}

function BattleBoard({
  me,
  players,
  gameState,
  playerId,
  canAct,
  selectedCardIdx,
  selectedTargetId,
  selectedDefenseIdxes,
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
  canAct: boolean;
  selectedCardIdx: number | null;
  selectedTargetId: string | null;
  selectedDefenseIdxes: number[];
  hitFlash: { amount: number; key: number } | null;
  onSelectTarget: (playerId: string) => void;
  onExecute: () => void;
  onPassDefense: () => void;
  onEndTurn: () => void;
}) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const selectedCard = selectedCardIdx !== null && me ? playableCards(me)[selectedCardIdx] : null;
  const defenseCards = me
    ? selectedDefenseIdxes
        .map((idx) => me.hand[idx])
        .filter((card): card is { id: string } => Boolean(card))
    : [];
  const pending = gameState.pendingAttack;
  const isDefending = gameState.phase === "defense" && pending?.defenderId === playerId;
  const targetPlayerId = pending?.defenderId ?? selectedTargetId;
  const targetPlayer = targetPlayerId
    ? players.find((p) => p.id === targetPlayerId)
    : null;
  const leftCard = isDefending ? pending?.card : selectedCard;
  const defensePower = defenseCards.reduce((total, card) => total + getDefensePower(card.id), 0);
  const canPassDefense = isDefending && defenseCards.length === 0;
  const canEndTurn = canAct && !gameState.winner && !isDefending;
  const actionLabel = isDefending
    ? defenseCards.length > 0
      ? `${defenseCards.length}枚 防${defensePower}で受ける`
      : "防御なしで受ける"
    : selectedCard
      ? "アクション実行"
      : canAct
        ? "カードを選択"
        : gameState.phase === "defense"
          ? "相手の防御待ち"
        : "相手のターン";

  return (
    <section className="gf-battle-board" aria-label="戦闘">
      <div className="gf-battle-status-grid" aria-label="プレイヤー状況">
        <NamePlate label="ターン" name={activePlayer?.name ?? "?"} tone="teal" />
        <NamePlate
          label={pending ? "攻撃対象" : "ターゲット"}
          name={targetPlayer?.name ?? "未選択"}
          tone="blue"
        />
        <div className="gf-match-player-list" aria-label="参加プレイヤー">
          {players.map((p) => (
            <NamePlate
              key={p.id}
              label={p.id === playerId ? "あなた" : "参加者"}
              name={p.name}
              tone={p.id === playerId ? "teal" : "blue"}
              compact
            />
          ))}
        </div>
      </div>

      <button
        className="gf-active-card"
        onClick={onExecute}
        disabled={!selectedCard || !canAct || isDefending}
      >
        {leftCard ? (
          <LargeCard cardRef={leftCard} />
        ) : (
          <span className="gf-active-card-placeholder">カード</span>
        )}
      </button>

      <div
        className="gf-action-stage"
        role={isDefending ? "button" : undefined}
        tabIndex={isDefending ? 0 : undefined}
        aria-disabled={!isDefending}
        onClick={isDefending ? onPassDefense : undefined}
        onKeyDown={(e) => {
          if (!isDefending) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPassDefense();
          }
        }}
      >
        <div className="gf-turn-ribbon">
          {gameState.winner
            ? "ゲーム終了"
            : isDefending
              ? "防御カードを選択"
              : canAct
                ? "あなたのターン"
                : gameState.phase === "defense"
                  ? "防御待ち"
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
          className={`gf-action-label${isDefending ? " is-danger" : ""}`}
        >
          {actionLabel}
        </div>
        {(canPassDefense || canEndTurn) && (
          <button
            className="gf-btn gf-end-turn-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (canPassDefense) {
                onPassDefense();
              } else {
                onEndTurn();
              }
            }}
          >
            {canPassDefense ? "許す" : "ターン終了"}
          </button>
        )}
      </div>

      <div className="gf-target-list">
        {players.map((p) => (
          <button
            className="gf-target-pill"
            key={p.id}
            onClick={() => onSelectTarget(p.id)}
            disabled={!canAct || isDefending}
            style={{
              color: p.id === playerId ? "var(--bar-teal-dark)" : "#3f35d8",
            }}
            data-selected={selectedTargetId === p.id}
          >
            <span className="gf-target-dot" />
            <span className="gf-target-name">{p.name}</span>
            <span className="gf-target-stats">
              <b>HP</b> {p.hp} <b>MP</b> {p.mp} <b>￥</b> 20
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function NamePlate({
  label,
  name,
  tone,
  compact = false,
}: {
  label: string;
  name: string;
  tone: "teal" | "blue";
  compact?: boolean;
}) {
  return (
    <div className={`gf-name-plate tone-${tone}${compact ? " is-compact" : ""}`}>
      <span className="gf-name-dot" />
      <span className="gf-name-label">{label}</span>
      <span className="gf-name-text">{name}</span>
    </div>
  );
}

function LargeCard({ cardRef }: { cardRef: { id: string } }) {
  const card = findCard(cardRef.id);
  if (!card) return null;
  const power =
    card.category === "miracle"
      ? card.mpCost
      : card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  return (
    <div className="gf-large-card">
      <div className="gf-large-card-art">
        {card.emoji}
      </div>
      <div className="gf-large-card-body">
        <div className="gf-large-card-name">{card.name}</div>
        <div className="gf-large-card-power">
          {card.category === "miracle" ? "MP" : card.category === "shield" ? "守" : "攻"}
          {power ?? ""}
        </div>
        <div className="gf-large-card-desc">{card.description}</div>
      </div>
    </div>
  );
}

function isDefenseCard(cardId: string): boolean {
  return findCard(cardId)?.effects.some((effect) => effect.kind === "defense") ?? false;
}

function isDefenseOnlyCard(cardId: string): boolean {
  const card = findCard(cardId);
  return card ? card.effects.every((effect) => effect.kind === "defense") : false;
}

function getDefensePower(cardId: string): number {
  return findCard(cardId)?.effects.find((effect) => effect.kind === "defense")?.amount ?? 0;
}

function isAttackCard(cardId: string): boolean {
  return (
    findCard(cardId)?.effects.some(
      (effect) => effect.kind === "damage" && effect.target === "opponent",
    ) ?? false
  );
}

function defaultTargetId(
  cardId: string,
  selfId: string,
  opponentId: string | null,
): string | undefined {
  return isAttackCard(cardId) ? (opponentId ?? undefined) : selfId;
}

function playableCards(player: PlayerState): { id: string }[] {
  return [...player.hand, ...player.learnedMiracles];
}
