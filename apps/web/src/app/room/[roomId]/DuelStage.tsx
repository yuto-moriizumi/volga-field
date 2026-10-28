"use client";

import { findCard } from "@volga/game-core";
import { LargeCard } from "./LargeCard";
import {
  duelStageAnnouncement,
  duelTurnText,
  partyActionAnnouncement,
  partyEffectLabel,
  type DuelCard,
  type DuelEffect,
  type DuelPresentation,
  type DuelTurn,
  type PartyPresentation,
} from "./battleSequence";

/**
 * Field-sized renderings of the duel steps. These replace the full-screen
 * overlay for attacks: the card and the attacker stay on the left, the target
 * name, the defense card and the effect stay in the centre.
 */

export function DuelCardView({
  card,
  tone,
}: {
  card: DuelCard;
  tone: "attack" | "defense";
}) {
  const definition = card.id ? findCard(card.id) : null;
  const nameMismatch = Boolean(definition && definition.name !== card.name);
  return (
    <div className={`gf-duel-card is-${tone}`}>
      {definition ? (
        <LargeCard cardRef={{ id: definition.id }} />
      ) : (
        <div className="gf-duel-card-plain">
          <span className="gf-duel-card-emoji">⚔</span>
          <span className="gf-duel-card-name">{card.name}</span>
        </div>
      )}
      {nameMismatch && <div className="gf-duel-card-label">{card.name}</div>}
    </div>
  );
}

export function DuelDefenseView({ cards }: { cards: DuelCard[] }) {
  if (cards.length === 0) {
    return (
      <div className="gf-duel-none" data-step="defense">
        防御なし
      </div>
    );
  }
  return (
    <div className="gf-duel-defense" data-step="defense">
      {cards.map((card, index) => (
        <DuelCardView
          key={`${card.id ?? card.name}-${index}`}
          card={card}
          tone="defense"
        />
      ))}
    </div>
  );
}

export function DuelEffectView({
  effect,
  defenderName,
  recoil,
  attackerName,
}: {
  effect: DuelEffect;
  defenderName: string;
  recoil: number;
  attackerName: string;
}) {
  return (
    <div
      className={`gf-duel-effect${effect.blocked ? " is-blocked" : ""}${
        effect.selfDamage ? " is-self" : ""
      }`}
      data-step="effect"
      data-effect={effect.blocked ? "blocked" : "damage"}
    >
      {effect.defended && (
        <div className="gf-duel-effect-shield">
          <span aria-hidden="true">🛡️</span>
          <span>
            {effect.blocked
              ? "防いだ！"
              : effect.defensePower
                ? `${effect.defensePower}軽減`
                : "防御"}
          </span>
        </div>
      )}
      <div className="gf-duel-effect-number" aria-hidden="true">
        {effect.blocked ? "0" : `-${effect.amount}`}
      </div>
      <div className="gf-duel-effect-target">
        {defenderName}
        {effect.selfDamage ? "（自分）" : ""}
      </div>
      {effect.blocked && (
        <div className="gf-duel-effect-note">ノーダメージ</div>
      )}
      {recoil > 0 && (
        <div className="gf-duel-effect-recoil" data-step="recoil">
          {attackerName}に反動 -{recoil}
        </div>
      )}
    </div>
  );
}

export function DuelTurnView({ turn }: { turn: DuelTurn }) {
  return (
    <div
      className={`gf-duel-turn${turn.isSelf ? " is-self" : ""}`}
      data-step="turn"
    >
      <div className="gf-duel-turn-main">{duelTurnText(turn)}</div>
      <div className="gf-duel-turn-sub">
        {turn.isSelf ? "あなた（手番）" : turn.playerName}
      </div>
    </div>
  );
}

/**
 * The party action as a card in the left field: party emoji, party name, the
 * effect amount and the action name in the description slot. Deliberately the
 * same anatomy as `LargeCard`, in the party (amber) tone instead of attack red.
 */
export function PartyActionCard({ party }: { party: PartyPresentation }) {
  const definition = party.cardId ? findCard(party.cardId) : null;
  const emoji = definition?.emoji ?? "🚩";
  return (
    <div className="gf-party-action-card" data-step="party-card">
      <div className="gf-party-action-art" aria-hidden="true">
        {emoji}
      </div>
      <div className="gf-party-action-body">
        <div className="gf-party-action-name">{party.partyName}</div>
        <div className="gf-party-action-power">
          {partyEffectLabel(party.effect)}
        </div>
        <div className="gf-party-action-desc">{party.actionName}</div>
      </div>
    </div>
  );
}

/** What the party action did to the target, shown on the right side. */
export function PartyImpactView({ party }: { party: PartyPresentation }) {
  const { kind, amount } = party.effect;
  const lost = kind === "damage" || kind === "steal";
  const unit = kind === "heal" ? "HP" : kind === "mp" ? "MP" : kind === "money" || kind === "steal" ? "￥" : "";
  return (
    <div
      className="gf-party-impact"
      data-kind={kind}
      data-step="party-effect"
      aria-hidden="true"
    >
      <div className="gf-party-impact-value">
        {lost ? `-${amount}` : `+${amount}`}
        {unit && <small>{unit}</small>}
      </div>
      <div className="gf-party-impact-label">{party.actionName}</div>
    </div>
  );
}

export function PartyAnnouncer({ party }: { party: PartyPresentation }) {
  return (
    <p className="gf-duel-live" role="status" aria-live="polite">
      {partyActionAnnouncement(party)}
    </p>
  );
}

export function DuelDrawChip({ count }: { count: number }) {  if (count <= 0) return null;
  return (
    <div className="gf-duel-draw" data-step="draw">
      <span aria-hidden="true">🃏</span> {count}枚ドロー
    </div>
  );
}

/** Screen-reader narration for every step of the sequence. */
export function DuelAnnouncer({ duel }: { duel: DuelPresentation }) {
  return (
    <p className="gf-duel-live" role="status" aria-live="polite">
      {duelStageAnnouncement(duel)}
    </p>
  );
}
