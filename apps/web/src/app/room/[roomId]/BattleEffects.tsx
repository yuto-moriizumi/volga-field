"use client";

import { BASE_CARDS, findCard } from "@volga/game-core";
import type { PlayerId, PlayerState } from "@volga/shared";
import {
  battleEventText,
  type AttackEvent,
  type DamageEvent,
  type DrawEvent,
  type HealEvent,
  type MoneyEvent,
  type MpRecoverEvent,
  type PresentedBattleEvent,
  type TurnEvent,
} from "./battleEvents";

interface BattleEffectsProps {
  current: PresentedBattleEvent | null;
  players: PlayerState[];
  viewerId: PlayerId | null;
  onSkip: () => void;
}

export function BattleEffects({
  current,
  players,
  viewerId,
  onSkip,
}: BattleEffectsProps) {
  if (!current) return null;

  const resolveName = (playerId: PlayerId) =>
    players.find((player) => player.id === playerId)?.name ?? "?";
  const text = battleEventText(current.event, resolveName);

  return (
    <div className="gf-battle-effects">
      <button
        type="button"
        className="gf-effect-skip-layer"
        onClick={onSkip}
        aria-label="演出をスキップ"
      />
      <div className="gf-effect-visual" key={current.key} aria-hidden="true">
        <EventVisual
          event={current.event}
          players={players}
          viewerId={viewerId}
          resolveName={resolveName}
        />
        <div className="gf-effect-skip-hint">クリック / Space でスキップ</div>
      </div>
      <p className="gf-effect-announcer" role="status" aria-live="polite">
        {text}
      </p>
    </div>
  );
}

function EventVisual({
  event,
  players,
  viewerId,
  resolveName,
}: {
  event: PresentedBattleEvent["event"];
  players: PlayerState[];
  viewerId: PlayerId | null;
  resolveName: (playerId: PlayerId) => string;
}) {
  switch (event.kind) {
    case "attack":
      return (
        <AttackVisual
          event={event}
          viewerId={viewerId}
          resolveName={resolveName}
        />
      );
    case "damage":
      return <DamageVisual event={event} resolveName={resolveName} />;
    case "heal":
    case "mpRecover":
    case "money":
      return <SupportVisual event={event} resolveName={resolveName} />;
    case "turn":
      return (
        <TurnVisual
          event={event}
          playerCount={players.length}
          resolveName={resolveName}
        />
      );
    case "draw":
      return <DrawVisual event={event} />;
  }
}

function AttackVisual({
  event,
  viewerId,
  resolveName,
}: {
  event: AttackEvent;
  viewerId: PlayerId | null;
  resolveName: (playerId: PlayerId) => string;
}) {
  const emoji = cardEmoji(event.cardId, event.cardName);
  const reverse = viewerId !== null && event.attackerId !== viewerId;
  return (
    <>
      <div className={`gf-attack-fly${reverse ? " is-reverse" : ""}`}>
        <div className="gf-attack-trail" />
        <div className="gf-attack-card">
          <span className="gf-attack-card-emoji">{emoji}</span>
          <span className="gf-attack-card-name">{event.cardName}</span>
          {event.amount !== null && event.amount > 0 && (
            <span className="gf-attack-card-power">攻{event.amount}</span>
          )}
        </div>
      </div>
      <div className={`gf-attack-caption${reverse ? " is-reverse" : ""}`}>
        {resolveName(event.attackerId)} → {resolveName(event.defenderId)}
      </div>
    </>
  );
}

function DamageVisual({
  event,
  resolveName,
}: {
  event: DamageEvent;
  resolveName: (playerId: PlayerId) => string;
}) {
  return (
    <div
      className={`gf-damage-effect${event.selfDamage ? " is-self" : ""}${
        event.blocked ? " is-blocked" : ""
      }`}
    >
      <div className="gf-impact-burst" />
      {event.defended && (
        <div className="gf-defense-shield">
          <span className="gf-defense-shield-icon">🛡️</span>
          <span className="gf-defense-shield-label">
            {event.blocked
              ? "防いだ！"
              : event.defensePower
                ? `${event.defensePower}軽減`
                : "防御"}
          </span>
        </div>
      )}
      <div className="gf-damage-number">
        {event.blocked ? "0" : `-${event.amount}`}
      </div>
      <div className="gf-damage-target">
        {resolveName(event.playerId)}
        {event.selfDamage ? "（自分）" : ""}
      </div>
      {event.blocked && <div className="gf-damage-note">ノーダメージ</div>}
    </div>
  );
}

function SupportVisual({
  event,
  resolveName,
}: {
  event: HealEvent | MpRecoverEvent | MoneyEvent;
  resolveName: (playerId: PlayerId) => string;
}) {
  const tone =
    event.kind === "heal" ? "heal" : event.kind === "mpRecover" ? "mp" : "money";
  const value =
    event.kind === "money"
      ? `${event.delta > 0 ? "+" : ""}${event.delta}`
      : `+${event.amount}`;
  const unit = event.kind === "heal" ? "HP" : event.kind === "mpRecover" ? "MP" : "￥";
  const icon = tone === "heal" ? "💚" : tone === "mp" ? "🔵" : "🪙";
  return (
    <div className={`gf-support-effect tone-${tone}`}>
      <div className="gf-support-glow" />
      <div className="gf-support-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="gf-support-name">
        {icon} {resolveName(event.playerId)}
      </div>
      <div className="gf-sparkles">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
      </div>
    </div>
  );
}

function TurnVisual({
  event,
  playerCount,
  resolveName,
}: {
  event: TurnEvent;
  playerCount: number;
  resolveName: (playerId: PlayerId) => string;
}) {
  const main = event.isSelf
    ? "あなたのターン"
    : playerCount > 2
      ? `${event.playerName}のターン`
      : "相手のターン";
  const sub = event.isSelf
    ? `${resolveName(event.playerId)}${event.continuation ? "（継続）" : ""}`
    : event.playerName;
  return (
    <div className={`gf-turn-banner${event.isSelf ? " is-self" : ""}`}>
      <div className="gf-turn-banner-main">{main}</div>
      <div className="gf-turn-banner-sub">{sub}</div>
    </div>
  );
}

function DrawVisual({ event }: { event: DrawEvent }) {
  return (
    <div className="gf-draw-effect">
      <div className="gf-draw-card" />
      <div className="gf-draw-label">{event.count}枚ドロー</div>
    </div>
  );
}

function cardEmoji(cardId: string | null, cardName: string): string {
  if (cardId) {
    const card = findCard(cardId);
    if (card) return card.emoji;
  }
  const firstName = cardName.split("+")[0]?.trim();
  if (firstName) {
    const card = BASE_CARDS.find((definition) => definition.name === firstName);
    if (card) return card.emoji;
  }
  return "⚔";
}
