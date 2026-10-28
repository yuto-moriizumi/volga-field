import { BASE_CARDS, findCard } from "@volga/game-core";
import type { BattleLogEntry, GameState, PlayerId } from "@volga/shared";
import { isAttackDeclarationLog, splitSupportEventsBeforeAttack } from "./battleEvents";
import type {
  BattleEvent,
  DamageEvent,
  DrawEvent,
  TurnEvent,
} from "./battleEvents";

/**
 * A duel is one attack (and its defense/damage) presented step by step inside
 * the field instead of as a full-screen overlay.
 *
 * The whole presentation is a fixed 1s cadence: the data may arrive all at
 * once, but the steps are only advanced by the hook's timers. The only input
 * that can pause the cadence is the local defense decision (the defender has to
 * pick cards first) and a not-yet-arrived damage resolution.
 */

export const DUEL_STEP_MS = 1_000;
/**
 * The field is cleared first so the played card arrives on an empty stage. That
 * empty beat is deliberately shorter than a normal step: it carries no
 * information, and a full second of blank field feels like a stall.
 */
export const DUEL_CLEAR_MS = 500;
/**
 * Own defense confirmation: clear the centre field, then reveal the card. Kept
 * at 100ms because the player already committed by pressing the button, and
 * waiting half a second there makes the confirmation feel unresponsive.
 */
export const DUEL_DEFENSE_STEP_MS = 100;
/** How long the turn banner stays up before the normal UI comes back. */
export const DUEL_TURN_HOLD_MS = 500;
/**
 * When the resolution arrived very recently, wait a little for a follow-up
 * state before deciding that the turn did not change. The server may broadcast
 * the resolution and the turn end as two separate messages; both normally land
 * within a few milliseconds.
 */
export const DUEL_TURN_SETTLE_MS = 300;

export type DuelStage =
  | "clear"
  | "attack"
  | "target"
  | "defenseClear"
  | "defense"
  | "effect"
  | "turn";

const STAGE_RANK: Record<DuelStage, number> = {
  clear: 0,
  attack: 1,
  target: 2,
  defenseClear: 3,
  defense: 4,
  effect: 5,
  turn: 6,
};

export interface DuelCard {
  id: string | null;
  name: string;
}

export interface DuelEffect {
  amount: number;
  defensePower: number | null;
  defended: boolean;
  blocked: boolean;
  selfDamage: boolean;
}

export interface DuelTurn {
  playerId: PlayerId;
  playerName: string;
  isSelf: boolean;
  continuation: boolean;
}

export interface PlayerStats {
  hp: number;
  mp: number;
  money: number;
}

export interface DuelModel {
  key: number;
  attackerId: PlayerId;
  defenderId: PlayerId;
  attackerName: string;
  defenderName: string;
  attackCard: DuelCard;
  /** Attack power while it was still pending. `null` when it was never observed. */
  attackAmount: number | null;
  /** `null` until the defense is known; `[]` means "defended without cards". */
  defenseCards: DuelCard[] | null;
  effect: DuelEffect | null;
  /** Self-damage dealt by the attack card itself (e.g. a thunder miracle). */
  recoil: number;
  turn: DuelTurn | null;
  drawCount: number;
  /** HP/MP/money as they were before the attack, frozen until the effect step. */
  statsBefore: Record<PlayerId, PlayerStats>;
}

export interface DuelPresentation {
  key: number;
  stage: DuelStage;
  attackerId: PlayerId;
  attackerName: string;
  defenderId: PlayerId;
  defenderName: string;
  attackCard: DuelCard;
  attackAmount: number | null;
  defenseCards: DuelCard[] | null;
  effect: DuelEffect | null;
  /** Self-damage dealt by the attack card itself (e.g. a thunder miracle). */
  recoil: number;
  turn: DuelTurn | null;
  drawCount: number;
  showAttackCard: boolean;
  showTargetName: boolean;
  showDefense: boolean;
  showEffect: boolean;
  showTurn: boolean;
  awaitingDefense: boolean;
  isSelfAttacker: boolean;
  isSelfDefender: boolean;
  /** `null` once the effect step starts, so the live values take over again. */
  statsBefore: Record<PlayerId, PlayerStats> | null;
}

export function buildDuelPresentation(
  model: DuelModel,
  stage: DuelStage,
  awaitingDefense: boolean,
  viewerId: PlayerId | null,
): DuelPresentation {
  const rank = STAGE_RANK[stage];
  return {
    key: model.key,
    stage,
    attackerId: model.attackerId,
    attackerName: model.attackerName,
    defenderId: model.defenderId,
    defenderName: model.defenderName,
    attackCard: model.attackCard,
    attackAmount: model.attackAmount,
    defenseCards: model.defenseCards,
    effect: model.effect,
    recoil: model.recoil,
    turn: model.turn,
    drawCount: model.drawCount,
    showAttackCard: rank >= STAGE_RANK.attack,
    showTargetName: rank >= STAGE_RANK.target,
    // The turn step replaces the effect in the centre so the banner is not
    // stacked on top of the damage / defense card.
    showDefense: stage === "defense" || stage === "effect",
    showEffect: stage === "effect",
    showTurn: stage === "turn",
    awaitingDefense,
    isSelfAttacker: viewerId !== null && model.attackerId === viewerId,
    isSelfDefender: viewerId !== null && model.defenderId === viewerId,
    statsBefore: rank >= STAGE_RANK.effect ? null : model.statsBefore,
  };
}

export function duelCardsFromRefs(
  cardRefs: readonly { id: string }[],
): DuelCard[] {
  return cardRefs.map((cardRef) => ({
    id: cardRef.id,
    name: findCard(cardRef.id)?.name ?? cardRef.id,
  }));
}

/** `${name}が${cardName}で防御` log entries → card references. */
export function defenseCardsFromLog(entries: BattleLogEntry[]): DuelCard[] {
  const cards: DuelCard[] = [];
  for (const entry of entries) {
    if (entry.kind !== "defense") continue;
    const match = /が(.+)で防御/.exec(entry.message);
    const name = match?.[1]?.trim();
    if (!name) continue;
    const definition = BASE_CARDS.find((card) => card.name === name);
    cards.push({ id: definition?.id ?? null, name });
  }
  return cards;
}

function statsSnapshot(state: GameState): Record<PlayerId, PlayerStats> {
  const snapshot: Record<PlayerId, PlayerStats> = {};
  for (const player of state.players) {
    snapshot[player.id] = {
      hp: player.hp,
      mp: player.mp,
      money: player.money,
    };
  }
  return snapshot;
}

function copyStats(
  source: Record<PlayerId, PlayerStats>,
): Record<PlayerId, PlayerStats> {
  const copy: Record<PlayerId, PlayerStats> = {};
  for (const [id, stats] of Object.entries(source)) {
    copy[id] = { ...stats };
  }
  return copy;
}

function playerName(
  id: PlayerId,
  next: GameState,
  previous: GameState,
): string {
  return (
    next.players.find((player) => player.id === id)?.name ??
    previous.players.find((player) => player.id === id)?.name ??
    "?"
  );
}

function toEffect(event: DamageEvent): DuelEffect {
  return {
    amount: event.amount,
    defensePower: event.defensePower,
    defended: event.defended,
    blocked: event.blocked,
    selfDamage: event.selfDamage,
  };
}

/**
 * A turn step is shown only when the state says the turn moved away from the
 * attacker. Attacks that do not end the attacker's turn therefore finish
 * without a banner, and the rule change is irrelevant to the presentation.
 */
function changedTurn(
  model: DuelModel,
  next: GameState,
  viewerId: PlayerId | null,
): DuelTurn | null {
  const active = next.players[next.activePlayerIndex];
  if (!active) return null;
  if (active.id === model.attackerId) return null;
  return {
    playerId: active.id,
    playerName: active.name,
    isSelf: active.id === viewerId,
    continuation: false,
  };
}

export interface DuelBatch {
  duels: DuelModel[];
  /** Events that belong to the duels and must not be replayed as overlays. */
  consumed: BattleEvent[];
}

function isAttackDeclaration(entry: BattleLogEntry): boolean {
  return isAttackDeclarationLog(entry);
}

function parseAttackName(message: string): string {
  const match = /が(.+?)で攻撃/.exec(message);
  return match?.[1]?.trim() || "攻撃";
}

function logTargetId(
  entry: BattleLogEntry,
  players: GameState["players"],
): PlayerId | null {
  const sorted = [...players].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find((player) => entry.message.includes(`${player.name}が`))?.id ??
    null
  );
}

function defensePowerFromEntries(entries: BattleLogEntry[]): number {
  return defenseCardsFromLog(entries).reduce((total, card) => {
    const definition = card.id ? findCard(card.id) : null;
    return (
      total +
      (definition?.effects.find((effect) => effect.kind === "defense")?.amount ??
        0)
    );
  }, 0);
}

/**
 * Build every duel declared in this delta, in log order.
 *
 * The server can resolve a whole exchange in one tick: my attack, the AI
 * defense, my turn end, the AI draw and the AI's next attack all end up in a
 * single state update. Reading the attack declarations from the log (instead of
 * only the last `pendingAttack`) keeps both duels presentable.
 */
export function planDuels(
  previous: GameState,
  next: GameState,
  viewerId: PlayerId | null,
  events: BattleEvent[],
  startKey: number,
): DuelBatch {
  const newEntries = next.log.slice(previous.log.length);
  const segments: { attack: BattleLogEntry; entries: BattleLogEntry[] }[] = [];
  for (const entry of newEntries) {
    if (isAttackDeclaration(entry)) {
      segments.push({ attack: entry, entries: [] });
    } else if (segments.length > 0) {
      segments[segments.length - 1]!.entries.push(entry);
    }
  }
  if (segments.length === 0) return { duels: [], consumed: [] };

  const pending = next.pendingAttack;
  const previousPending = previous.pendingAttack;

  const duels: DuelModel[] = [];
  const statsNow = statsSnapshot(next);

  segments.forEach((segment, index) => {
    const attackerId = segment.attack.playerId;
    const cardName = parseAttackName(segment.attack.message);
    const pendingMatch =
      pending &&
      pending.attackerId === attackerId &&
      (pending.cardName === cardName || segments.length === 1)
        ? pending
        : null;
    const previousMatch =
      previousPending && previousPending.attackerId === attackerId
        ? previousPending
        : null;
    const defenseEntries = segment.entries.filter(
      (entry) => entry.kind === "defense",
    );
    const damageEntries = segment.entries.filter(
      (entry) => entry.kind === "attack" && typeof entry.damage === "number",
    );
    const recoilEntry = damageEntries.find(
      (entry) => logTargetId(entry, next.players) === attackerId,
    );
    const defenderDamage = damageEntries.find(
      (entry) => logTargetId(entry, next.players) !== attackerId,
    );
    const defenderId =
      pendingMatch?.defenderId ??
      previousMatch?.defenderId ??
      defenseEntries[0]?.playerId ??
      (defenderDamage ? logTargetId(defenderDamage, next.players) : null) ??
      next.players.find((player) => player.id !== attackerId)?.id;
    if (!defenderId) return;

    const resolved = Boolean(
      defenderDamage ||
        defenseEntries.length > 0 ||
        (previousMatch && !pending),
    );
    const attackAmount = pendingMatch?.amount ?? previousMatch?.amount ?? null;
    const ignored = defenseEntries.length > 0;
    const damage = defenderDamage?.damage ?? 0;
    const defensePower = resolved
      ? ignored
        ? attackAmount !== null
          ? Math.max(0, attackAmount - damage)
          : defensePowerFromEntries(defenseEntries)
        : null
      : null;
    const defenseCards = resolved
      ? defenseCardsFromLog(defenseEntries)
      : null;
    const draws = segment.entries.reduce((total, entry) => {
      if (!/枚ドロー/.test(entry.message)) return total;
      const count = /が(\d+)枚ドロー/.exec(entry.message)?.[1];
      return total + (count ? Number(count) : 0);
    }, 0);

    const nextSegment = segments[index + 1];
    const active = next.players[next.activePlayerIndex];
    const turnPlayerId =
      nextSegment && nextSegment.attack.playerId !== attackerId
        ? nextSegment.attack.playerId
        : !nextSegment && !pendingMatch && active && active.id !== attackerId
          ? active.id
          : null;
    const turnPlayer = turnPlayerId
      ? next.players.find((player) => player.id === turnPlayerId)
      : null;

    const statsBefore = copyStats(statsNow);

    duels.push({
      key: startKey + index,
      attackerId,
      defenderId,
      attackerName: playerName(attackerId, next, previous),
      defenderName: playerName(defenderId, next, previous),
      attackCard: {
        id: pendingMatch?.card.id ?? previousMatch?.card.id ?? null,
        name: pendingMatch?.cardName ?? cardName,
      },
      attackAmount,
      defenseCards,
      effect: resolved
        ? {
            amount: damage,
            defensePower,
            defended: ignored,
            blocked: ignored && damage === 0,
            selfDamage: false,
          }
        : null,
      recoil: recoilEntry?.damage ?? 0,
      turn: turnPlayer
        ? {
            playerId: turnPlayer.id,
            playerName: turnPlayer.name,
            isSelf: turnPlayer.id === viewerId,
            continuation: false,
          }
        : null,
      drawCount: draws,
      statsBefore,
    });
  });

  duels.forEach((duel, index) => {
    const adjusted: Record<PlayerId, PlayerStats> = {};
    for (const [playerId, value] of Object.entries(statsNow)) {
      adjusted[playerId] = { ...value };
    }
    for (let later = index; later < duels.length; later += 1) {
      const laterDuel = duels[later]!;
      if (!laterDuel.effect) continue;
      const defender = adjusted[laterDuel.defenderId];
      if (defender) defender.hp += laterDuel.effect.amount;
      const attacker = adjusted[laterDuel.attackerId];
      if (attacker) attacker.hp += laterDuel.recoil;
    }
    duel.statsBefore = adjusted;
  });

  const consumed: BattleEvent[] = [];
  for (const event of events) {
    if (event.kind === "attack") {
      consumed.push(event);
      continue;
    }
    if (
      event.kind === "damage" &&
      duels.some(
        (duel) =>
          event.playerId === duel.defenderId ||
          (event.selfDamage && event.playerId === duel.attackerId),
      )
    ) {
      consumed.push(event);
      continue;
    }
    if (event.kind === "turn" || event.kind === "draw") {
      consumed.push(event);
    }
  }

  return { duels, consumed };
}

export interface DeltaPlan {
  /**
   * Support events that the log places before this delta's first attack. They
   * happened on the previous turn and must be presented ahead of the duels.
   */
  leading: BattleEvent[];
  /** Duels declared in this delta, in log order. */
  duels: DuelModel[];
  /** Events left once the duels took theirs, in their original order. */
  events: BattleEvent[];
  /** Events absorbed by the duels. */
  consumed: BattleEvent[];
}

/**
 * Order one delta for presentation.
 *
 * The server broadcasts the exchange, the turn end and the AI's attack as
 * separate messages, but a slow client can receive them before React renders,
 * so all three arrive as one snapshot. In that snapshot the exchange's support
 * events sit before the attack declaration in the log, and they have to play
 * before the duel — otherwise the exchange effect only shows up after the
 * attack has been defended, i.e. on the wrong turn.
 *
 * Support events logged *after* the attack (the next turn's draw/heal/money)
 * stay behind the duels, so the new turn is not presented early.
 */
export function planDelta(
  previous: GameState,
  next: GameState,
  viewerId: PlayerId | null,
  events: BattleEvent[],
  startKey: number,
): DeltaPlan {
  const { before, after } = splitSupportEventsBeforeAttack(
    previous,
    next,
    events,
  );
  const batch = planDuels(previous, next, viewerId, after, startKey);
  const consumed = new Set(batch.consumed);
  return {
    leading: before,
    duels: batch.duels,
    events: after.filter((event) => !consumed.has(event)),
    consumed: batch.consumed,
  };
}

export interface DuelUpdate {
  model: DuelModel;
  consumed: BattleEvent[];
}

/**
 * Fold a later state into a duel that is already queued or playing.
 *
 * This is where the resolution, the defense cards and the turn change arrive
 * for a duel that was started from the pending attack alone.
 */
export function updateDuelModel(
  model: DuelModel,
  previous: GameState,
  next: GameState,
  viewerId: PlayerId | null,
  events: BattleEvent[],
): DuelUpdate {
  const consumed: BattleEvent[] = [];
  let effect = model.effect;
  let defenseCards = model.defenseCards;
  let turn = model.turn;
  let recoil = model.recoil;

  if (recoil === 0) {
    const recoilEvent = events.find(
      (event): event is DamageEvent =>
        event.kind === "damage" &&
        event.selfDamage &&
        event.playerId === model.attackerId,
    );
    if (recoilEvent) {
      consumed.push(recoilEvent);
      recoil = recoilEvent.amount;
    }
  }

  if (!effect) {
    const damage = events.find(
      (event): event is DamageEvent =>
        event.kind === "damage" && event.playerId === model.defenderId,
    );
    if (damage) {
      consumed.push(damage);
      effect = toEffect(damage);
      if (defenseCards === null) {
        defenseCards = defenseCardsFromLog(next.log.slice(previous.log.length));
      }
    }
  }

  if (!turn) {
    const turnEvent = events.find(
      (event): event is TurnEvent => event.kind === "turn",
    );
    // Prefer the authoritative active player over the event payload: a turn
    // event may describe an earlier switch (e.g. a separate end_turn state).
    turn = changedTurn(model, next, viewerId);
    if (turnEvent) consumed.push(turnEvent);
  }

  if (effect && defenseCards === null) defenseCards = [];

  return {
    model: { ...model, effect, defenseCards, recoil, turn },
    consumed,
  };
}

/** Add a draw that happened during a duel to the turn step instead of an overlay. */
export function absorbDraw(model: DuelModel, events: BattleEvent[]): {
  model: DuelModel;
  consumed: BattleEvent[];
} {
  const draws = events.filter(
    (event): event is DrawEvent => event.kind === "draw",
  );
  if (draws.length === 0) return { model, consumed: [] };
  return {
    model: {
      ...model,
      drawCount: model.drawCount + draws.reduce((sum, event) => sum + event.count, 0),
    },
    consumed: draws,
  };
}

export function duelEffectText(effect: DuelEffect, defenderName: string): string {
  if (effect.blocked) return `${defenderName}が攻撃を防いだ（ノーダメージ）`;
  const reduction =
    effect.defended && effect.defensePower
      ? `（${effect.defensePower}軽減）`
      : "";
  const self = effect.selfDamage ? "（反動）" : "";
  return `${defenderName}に${effect.amount}ダメージ${reduction}${self}`;
}

export function duelTurnText(turn: DuelTurn): string {
  if (turn.isSelf) return "あなたのターン";
  return `${turn.playerName}のターン`;
}

/** Text for the aria-live region, one line per step. */
export function duelStageAnnouncement(
  duel: DuelPresentation,
): string {
  switch (duel.stage) {
    case "clear":
    case "attack":
      return `${duel.attackerName}が${duel.attackCard.name}で攻撃`;
    case "target":
      return `使用先は${duel.defenderName}`;
    case "defenseClear":
      return "";
    case "defense": {
      const cards = duel.defenseCards ?? [];
      if (cards.length === 0) return `${duel.defenderName}は防御しなかった`;
      return `${duel.defenderName}が${cards.map((card) => card.name).join("、")}で防御`;
    }
    case "effect": {
      if (!duel.effect) return "";
      const draw =
        duel.drawCount > 0 ? `。${duel.drawCount}枚ドロー` : "";
      const recoil = duel.recoil > 0 ? `。${duel.attackerName}に反動${duel.recoil}` : "";
      return `${duelEffectText(duel.effect, duel.defenderName)}${recoil}${draw}`;
    }
    case "turn":
      return duel.turn ? duelTurnText(duel.turn) : "";
  }
}
