"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useGameSocket } from "@/lib/useGameSocket";
import { findCard, getCardPrice } from "@volga/game-core";
import type { CardRef, GameState, PlayerState } from "@volga/shared";
import { BottomBar } from "../../_components/BottomBar";
import { TopBar } from "../../_components/TopBar";
import { HandArea } from "./HandArea";
import { Header } from "./Header";
import { InfoArea } from "./InfoArea";
import { NameList } from "./NameList";
import { SourceArea, type ExchangeDraft } from "./SourceArea";
import { TargetArea } from "./TargetArea";

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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedDefenseIdxes, setSelectedDefenseIdxes] = useState<number[]>([]);
  const [discardMode, setDiscardMode] = useState(false);
  const [sellMode, setSellMode] = useState(false);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeDraft, setExchangeDraft] = useState<ExchangeDraft | null>(null);
  const [selectedSellIdxes, setSelectedSellIdxes] = useState<number[]>([]);
  const [selectedDiscardIdxes, setSelectedDiscardIdxes] = useState<number[]>([]);
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

  useEffect(() => {
    if (canAct) return;
    setDiscardMode(false);
    setSellMode(false);
    setExchangeMode(false);
    setExchangeDraft(null);
    setSelectedDiscardIdxes([]);
    setSelectedSellIdxes([]);
  }, [canAct]);

  function playCard(idx: number) {
    if (!me || !canAct || discardMode || sellMode) return;
    const card = playableCards(me)[idx];
    if (!card) return;
    const nextSelectedIdx = selectedCardIdx === idx ? null : idx;
    setSelectedCardIdx(nextSelectedIdx);
    setSelectedCardId(nextSelectedIdx === null ? null : card.id);
    if (nextSelectedIdx === null) {
      setSelectedTargetId(null);
      return;
    }
    if (card.id === "exchange") {
      setExchangeMode(true);
      setExchangeDraft({ hp: me.hp, mp: me.mp, money: me.money });
      setSelectedTargetId(null);
      return;
    }
    const isTrade = findCard(card.id)?.category === "trade";
    if (isTrade) {
      setSelectedTargetId(opponent?.id ?? null);
    } else {
      setSelectedTargetId(defaultTargetId(card.id, me.id, opponent?.id ?? null) ?? null);
    }
  }

  function executeSelectedCard() {
    if (!me || !canAct || discardMode || sellMode) return;
    const cardId = selectedCardId;
    if (!cardId) return;
    const card = playableCards(me).find((c) => c.id === cardId);
    if (!card) return;
    const definition = findCard(card.id);
    const target = selectedTargetId ?? defaultTargetId(card.id, me.id, opponent?.id ?? null);
    if (definition?.category === "trade") {
      if (!target) return;
      if (card.id === "buy") {
        send({
          type: "buy_card",
          cardRef: { id: card.id },
          targetPlayerId: target,
        });
      } else if (card.id === "sell") {
        if (sellMode && selectedSellIdxes.length > 0) {
          const cardRefs = selectedSellIdxes
            .map((i) => me.hand[i])
            .filter((c): c is { id: string } => Boolean(c) && c.id !== "sell")
            .map((c) => ({ id: c.id }));
          if (cardRefs.length > 0) {
            send({
              type: "sell_cards",
              cardRefs,
              targetPlayerId: target,
            });
          }
          setSellMode(false);
          setSelectedSellIdxes([]);
        } else {
          setSellMode(true);
          setSelectedSellIdxes([]);
        }
      } else if (card.id === "exchange") {
        setExchangeMode(true);
        setExchangeDraft({ hp: me.hp, mp: me.mp, money: me.money });
      }
    } else if (sellMode) {
      if (card.id !== "sell" && target) {
        const cardRefs = [{ id: card.id }];
        send({
          type: "sell_cards",
          cardRefs,
          targetPlayerId: target,
        });
        setSellMode(false);
        setSelectedSellIdxes([]);
      }
    } else {
      send({
        type: "play_card",
        cardRef: { id: card.id },
        targetPlayerId: target,
      });
    }
    setSelectedCardIdx(null);
    setSelectedCardId(null);
    setSelectedTargetId(null);
  }

  function adjustExchange(stat: "mp" | "money", delta: number) {
    setExchangeDraft((current) => {
      if (!current || !me) return current;
      const nextValue = Math.max(0, current[stat] + delta);
      const updated: ExchangeDraft = { ...current, [stat]: nextValue };
      const consumed =
        (updated.mp - me.mp) + (updated.money - me.money);
      updated.hp = Math.max(0, me.hp - consumed);
      return updated;
    });
  }

  function confirmExchange() {
    if (!me || !exchangeDraft) return;
    const mpDelta = exchangeDraft.mp - me.mp;
    const moneyDelta = exchangeDraft.money - me.money;
    if (mpDelta === 0 && moneyDelta === 0) return;
    send({ type: "exchange_stats", mpDelta, moneyDelta });
    setExchangeMode(false);
    setExchangeDraft(null);
    setSelectedCardIdx(null);
    setSelectedCardId(null);
    setSelectedTargetId(null);
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
    setDiscardMode(false);
    setSellMode(false);
    setExchangeMode(false);
    setExchangeDraft(null);
    setSelectedDiscardIdxes([]);
    setSelectedSellIdxes([]);
    setSelectedCardIdx(null);
    setSelectedCardId(null);
    send({ type: "end_turn" });
  }

  function toggleDiscardMode() {
    if (!canAct) return;
    setDiscardMode((current) => {
      const next = !current;
      if (next) {
        setSellMode(false);
        setExchangeMode(false);
        setExchangeDraft(null);
        setSelectedSellIdxes([]);
        setSelectedCardIdx(null);
        setSelectedCardId(null);
        setSelectedTargetId(null);
      } else {
        setSelectedDiscardIdxes([]);
      }
      return next;
    });
  }

  function toggleSellMode() {
    if (!canAct) return;
    setSellMode((current) => {
      const next = !current;
      if (next) {
        setDiscardMode(false);
        setExchangeMode(false);
        setExchangeDraft(null);
        setSelectedDiscardIdxes([]);
      } else {
        setSelectedSellIdxes([]);
      }
      return next;
    });
  }

  function confirmDiscard() {
    if (!me || !canAct || !discardMode || selectedDiscardIdxes.length === 0) return;
    const cardRefs = selectedDiscardIdxes
      .map((idx) => me.hand[idx])
      .filter((card): card is { id: string } => Boolean(card))
      .map((card) => ({ id: card.id }));
    send({ type: "discard_cards", cardRefs });
    setDiscardMode(false);
    setSelectedDiscardIdxes([]);
  }

  function acceptBuy() {
    if (!me || !gameState?.pendingBuy) return;
    if (gameState.pendingBuy.sourceId !== playerId) return;
    send({ type: "confirm_buy", accept: true });
  }

  function declineBuy() {
    if (!me || !gameState?.pendingBuy) return;
    if (gameState.pendingBuy.sourceId !== playerId) return;
    send({ type: "confirm_buy", accept: false });
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
  const pendingBuy = gameState.pendingBuy;
  const pendingSell = gameState.pendingSell;
  const myPendingBuy = pendingBuy && pendingBuy.sourceId === playerId ? pendingBuy : null;
  const canAffordBuy = myPendingBuy ? (me?.money ?? 0) >= myPendingBuy.price : false;

  return (
    <div className={`gf-app${gameState.doomsdayActive ? " gf-doomsday-active" : ""}`}>
      <Header actionTurn={displayedActionTurn} onBack={leaveRoom} />

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
            <div className="gf-battle-row">
              <BattleField
                me={me}
                players={gameState.players}
                gameState={gameState}
                playerId={playerId}
                canAct={canAct}
                selectedCardId={selectedCardId}
                selectedTargetId={selectedTargetId}
                selectedDefenseIdxes={selectedDefenseIdxes}
                discardMode={discardMode}
                sellMode={sellMode}
                exchangeMode={exchangeMode}
                exchangeDraft={exchangeDraft}
                selectedDiscardCount={selectedDiscardIdxes.length}
                selectedSellCount={selectedSellIdxes.length}
                sellTotalPrice={sellTotalPrice(me, selectedSellIdxes)}
                pendingBuy={myPendingBuy}
                pendingSell={pendingSell}
                canAffordBuy={canAffordBuy}
                hitFlash={hitFlash}
                onSelectTarget={setSelectedTargetId}
                onExecute={executeSelectedCard}
                onAcceptBuy={acceptBuy}
                onDeclineBuy={declineBuy}
                onPassDefense={() => defend(selectedDefenseIdxes)}
                onEndTurn={endTurn}
                onConfirmDiscard={confirmDiscard}
                onAdjustExchange={adjustExchange}
                onConfirmExchange={confirmExchange}
              />
            </div>
            <div className="gf-battle-row gf-battle-row-split">
              <HandArea
                me={me}
                canAct={canAct}
                isDefending={isDefending}
                selectedCardId={selectedCardId}
                selectedDefenseIdxes={selectedDefenseIdxes}
                discardMode={discardMode}
                sellMode={sellMode}
                selectedSellIdxes={selectedSellIdxes}
                selectedDiscardIdxes={selectedDiscardIdxes}
                onPlayCard={playCard}
                onHoverCard={setLastHoveredCard}
                onSelectDefense={(idx) =>
                  setSelectedDefenseIdxes((current) =>
                    current.includes(idx)
                      ? current.filter((selectedIdx) => selectedIdx !== idx)
                      : [...current, idx],
                  )
                }
                onSelectDiscard={(idx) =>
                  setSelectedDiscardIdxes((current) =>
                    current.includes(idx)
                      ? current.filter((selectedIdx) => selectedIdx !== idx)
                      : [...current, idx],
                  )
                }
                onSelectSell={(idx) =>
                  setSelectedSellIdxes((current) =>
                    current.includes(idx)
                      ? current.filter((selectedIdx) => selectedIdx !== idx)
                      : [...current, idx],
                  )
                }
                onToggleDiscardMode={toggleDiscardMode}
                onToggleSellMode={toggleSellMode}
              />
              <InfoArea
                hoveredCard={lastHoveredCard}
                entries={gameState.log}
              />
            </div>
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
        {me && <span className="gf-tag">￥{me.money}</span>}
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

function BattleField({
  me,
  players,
  gameState,
  playerId,
  canAct,
  selectedCardId,
  selectedTargetId,
  selectedDefenseIdxes,
  discardMode,
  sellMode,
  exchangeMode,
  exchangeDraft,
  selectedDiscardCount,
  selectedSellCount,
  sellTotalPrice,
  pendingBuy,
  pendingSell,
  canAffordBuy,
  hitFlash,
  onSelectTarget,
  onExecute,
  onAcceptBuy,
  onDeclineBuy,
  onPassDefense,
  onEndTurn,
  onConfirmDiscard,
  onAdjustExchange,
  onConfirmExchange,
}: {
  me: PlayerState | null;
  players: PlayerState[];
  gameState: GameState;
  playerId: string | null;
  canAct: boolean;
  selectedCardId: string | null;
  selectedTargetId: string | null;
  selectedDefenseIdxes: number[];
  discardMode: boolean;
  sellMode: boolean;
  exchangeMode: boolean;
  exchangeDraft: ExchangeDraft | null;
  selectedDiscardCount: number;
  selectedSellCount: number;
  sellTotalPrice: number;
  pendingBuy: GameState["pendingBuy"];
  pendingSell: GameState["pendingSell"];
  canAffordBuy: boolean;
  hitFlash: { amount: number; key: number } | null;
  onSelectTarget: (playerId: string) => void;
  onExecute: () => void;
  onAcceptBuy: () => void;
  onDeclineBuy: () => void;
  onPassDefense: () => void;
  onEndTurn: () => void;
  onConfirmDiscard: () => void;
  onAdjustExchange: (stat: "mp" | "money", delta: number) => void;
  onConfirmExchange: () => void;
}) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const selectedCard =
    selectedCardId && me
      ? playableCards(me).find((c) => c.id === selectedCardId) ?? null
      : null;
  const defenseCards = me
    ? selectedDefenseIdxes
        .map((idx) => me.hand[idx])
        .filter((card): card is { id: string } => Boolean(card))
    : [];
  const pending = gameState.pendingAttack;
  const isDefending = gameState.phase === "defense" && pending?.defenderId === playerId;
  const targetPlayerId =
    pending?.defenderId ??
    pendingBuy?.targetId ??
    pendingSell?.targetId ??
    selectedTargetId;
  const targetPlayer = targetPlayerId
    ? players.find((p) => p.id === targetPlayerId)
    : null;
  const defensePower = defenseCards.reduce((total, card) => total + getDefensePower(card.id), 0);
  const selectedCards = isDefending ? defenseCards : selectedCard ? [selectedCard] : [];
  const canPassDefense = isDefending && defenseCards.length === 0;
  const canEndTurn = canAct && !gameState.winner && !isDefending;
  const canSelectTarget =
    canAct && !isDefending && !discardMode && !pendingBuy && !pendingSell;
  const canConfirmSelection =
    (isDefending && defenseCards.length > 0) ||
    (!isDefending &&
      Boolean(selectedCard) &&
      canAct &&
      !discardMode &&
      !pendingBuy &&
      !pendingSell) ||
    (discardMode && selectedDiscardCount > 0);
  const canConfirmEmpty =
    canPassDefense || (canEndTurn && selectedCards.length === 0 && !discardMode);
  const confirmDisabled = gameState.winner
    ? true
    : exchangeMode
      ? !exchangeDraft ||
        (exchangeDraft.mp - (me?.mp ?? 0) === 0 &&
          exchangeDraft.money - (me?.money ?? 0) === 0)
      : !(canConfirmSelection || canConfirmEmpty);
  const confirmLabel = isDefending
    ? defenseCards.length > 0
      ? `${defenseCards.length}枚 防${defensePower}`
      : "許す"
    : discardMode
      ? selectedDiscardCount > 0
        ? `${selectedDiscardCount}枚 捨てる`
        : "捨てるカードを選択"
      : sellMode
        ? selectedSellCount > 0
          ? `${selectedSellCount}枚 ￥${sellTotalPrice} で売る`
          : "売るカードを選択"
        : selectedCards.length === 0
          ? "ターン終了"
          : "確定";

  function confirmAction() {
    if (gameState.winner) return;
    if (exchangeMode) {
      onConfirmExchange();
      return;
    }
    if (isDefending) {
      onPassDefense();
      return;
    }
    if (discardMode) {
      onConfirmDiscard();
      return;
    }
    if (selectedCard) {
      onExecute();
      return;
    }
    if (canEndTurn) {
      onEndTurn();
    }
  }

  return (
    <>
      <SourceArea
        activePlayer={activePlayer}
        selectedCards={selectedCards}
        discardMode={discardMode}
        sellMode={sellMode}
        exchangeMode={exchangeMode}
        exchangeDraft={exchangeDraft}
        confirmLabel={confirmLabel}
        confirmDisabled={confirmDisabled}
        canEndTurn={canEndTurn}
        canPassDefense={canPassDefense}
        pendingBuy={pendingBuy}
        canAffordPendingBuy={canAffordBuy}
        onConfirm={confirmAction}
        onAcceptBuy={onAcceptBuy}
        onDeclineBuy={onDeclineBuy}
        onAdjustExchange={onAdjustExchange}
      />
      <TargetArea
        pending={pending}
        pendingBuy={pendingBuy}
        pendingSell={pendingSell}
        targetPlayer={targetPlayer ?? null}
        hitFlash={hitFlash}
      />
      <NameList
        players={players}
        playerId={playerId}
        selectedTargetId={selectedTargetId}
        canSelect={canSelectTarget}
        onSelect={onSelectTarget}
      />
    </>
  );
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
  const card = findCard(cardId);
  if (card?.category === "trade") return opponentId ?? undefined;
  return isAttackCard(cardId) ? (opponentId ?? undefined) : selfId;
}

function getDefensePower(cardId: string): number {
  return findCard(cardId)?.effects.find((effect) => effect.kind === "defense")?.amount ?? 0;
}

function sellTotalPrice(
  me: PlayerState | null,
  indexes: number[],
): number {
  if (!me) return 0;
  return indexes.reduce((total, idx) => {
    const card = me.hand[idx];
    if (!card || card.id === "sell") return total;
    return total + getCardPrice(card.id);
  }, 0);
}

function playableCards(player: PlayerState): { id: string }[] {
  return [...player.hand, ...player.learnedMiracles];
}
