import { BASE_CARDS } from "@volga/game-core";
import type { PartyActionKind } from "@volga/game-core";
import type {
  BattleLogEntry,
  GameState,
  PlayerId,
  PlayerState,
} from "@volga/shared";

export interface AttackEvent {
  kind: "attack";
  attackerId: PlayerId;
  defenderId: PlayerId;
  cardId: string | null;
  cardName: string;
  /** Pending attack power. `null` when the state was coalesced before the pending attack was observed. */
  amount: number | null;
}

export interface DamageEvent {
  kind: "damage";
  playerId: PlayerId;
  attackerId: PlayerId | null;
  amount: number;
  /** Amount absorbed by shields. `null` when it could not be observed. */
  defensePower: number | null;
  defended: boolean;
  blocked: boolean;
  selfDamage: boolean;
  cardName: string | null;
}

/**
 * Where an event sits in the delta it was derived from: the index of the log
 * entry that describes it, counted from the first new entry.
 *
 * The states arrive coalesced, so this is the only ordering information left
 * once the server messages have been merged into one snapshot. Events without
 * a log entry (stat changes inferred from a diff) have no position and are
 * treated as happening after the attacks of the delta.
 */
interface LogPositioned {
  logIndex?: number;
}

export interface HealEvent extends LogPositioned {
  kind: "heal";
  playerId: PlayerId;
  amount: number;
  cardName: string | null;
}

export interface MpRecoverEvent extends LogPositioned {
  kind: "mpRecover";
  playerId: PlayerId;
  amount: number;
  cardName: string | null;
}

export interface MoneyEvent extends LogPositioned {
  kind: "money";
  playerId: PlayerId;
  delta: number;
}

export interface PartyEvent extends LogPositioned {
  kind: "party";
  playerId: PlayerId;
  cardId: string;
  cardName: string;
  /** Party name before a switch; `null` for a first-time join. */
  previousPartyName: string | null;
}

/**
 * A party acting on its own at the end of a turn (25% roll per party member).
 *
 * The server only writes a `special` log line for these, so the whole event is
 * reconstructed from text: `共産党が動いた！ 労働者の反撃: ボブに3ダメージ`.
 */
export interface PartyActionEvent extends LogPositioned {
  kind: "partyAction";
  /** The party owner, i.e. the player whose party acted. */
  playerId: PlayerId;
  /** Party card id (`communist_party` …), used for the card face emoji. */
  cardId: string | null;
  partyName: string;
  actionName: string;
  /** Who the action landed on. `playerId` for self-targeted effects. */
  targetId: PlayerId | null;
  effect: {
    kind: PartyActionKind;
    amount: number;
  };
}

export interface TurnEvent {
  kind: "turn";
  playerId: PlayerId;
  playerName: string;
  isSelf: boolean;
}

export interface DrawEvent {
  kind: "draw";
  playerId: PlayerId;
  count: number;
}

export type BattleEvent =
  | AttackEvent
  | DamageEvent
  | HealEvent
  | MpRecoverEvent
  | MoneyEvent
  | PartyEvent
  | PartyActionEvent
  | TurnEvent
  | DrawEvent;

export interface PresentedBattleEvent {
  event: BattleEvent;
  key: number;
}

/**
 * How long a single queued battle event is presented, in milliseconds.
 *
 * Every kind uses the same value so the overlay animations have room to play
 * out. Keep this in sync with `--gf-effect-duration` in `globals.css`; the
 * queue timer and the CSS animation must end together. Reduced motion is
 * handled separately in `useBattleSequence`.
 */
export const BATTLE_EVENT_DURATION = 3000;

const EVENT_DURATION: Record<BattleEvent["kind"], number> = {
  attack: BATTLE_EVENT_DURATION,
  damage: BATTLE_EVENT_DURATION,
  heal: BATTLE_EVENT_DURATION,
  mpRecover: BATTLE_EVENT_DURATION,
  money: BATTLE_EVENT_DURATION,
  party: BATTLE_EVENT_DURATION,
  partyAction: BATTLE_EVENT_DURATION,
  turn: BATTLE_EVENT_DURATION,
  draw: BATTLE_EVENT_DURATION,
};

export function battleEventDuration(event: BattleEvent): number {
  return EVENT_DURATION[event.kind];
}

export function eventAffectsPlayer(
  event: BattleEvent,
  playerId: PlayerId | null,
): boolean {
  if (!playerId) return false;
  switch (event.kind) {
    case "attack":
      return event.attackerId === playerId || event.defenderId === playerId;
    case "damage":
    case "heal":
    case "mpRecover":
    case "money":
    case "party":
    case "turn":
    case "draw":
      return event.playerId === playerId;
    case "partyAction":
      return event.playerId === playerId || event.targetId === playerId;
  }
}

export function battleEventText(
  event: BattleEvent,
  resolveName: (playerId: PlayerId) => string,
): string {
  switch (event.kind) {
    case "attack":
      return `${resolveName(event.attackerId)}の${event.cardName}で攻撃`;
    case "damage": {
      const name = resolveName(event.playerId);
      if (event.blocked) return `${name}が攻撃を防いだ`;
      const reduction =
        event.defended && event.defensePower
          ? `（${event.defensePower}軽減）`
          : "";
      const self = event.selfDamage ? "（反動）" : "";
      return `${name}に${event.amount}ダメージ${reduction}${self}`;
    }
    case "heal":
      return `${resolveName(event.playerId)}のHPが${event.amount}回復`;
    case "mpRecover":
      return `${resolveName(event.playerId)}のMPが${event.amount}回復`;
    case "money": {
      const delta = `${event.delta > 0 ? "+" : ""}${event.delta}`;
      return `${resolveName(event.playerId)}の所持金が${delta}`;
    }
    case "party":
      return event.previousPartyName
        ? `${resolveName(event.playerId)}が${event.previousPartyName}から${event.cardName}へ所属を変更した`
        : `${resolveName(event.playerId)}が${event.cardName}に入党した`;
    case "partyAction": {
      const target = event.targetId ? resolveName(event.targetId) : "?";
      const amount = event.effect.amount;
      switch (event.effect.kind) {
        case "damage":
          return `${event.partyName}が動いた！${event.actionName}：${target}に${amount}ダメージ`;
        case "heal":
          return `${event.partyName}が動いた！${event.actionName}：${target}のHPが${amount}回復`;
        case "mp":
          return `${event.partyName}が動いた！${event.actionName}：${target}のMPが${amount}回復`;
        case "money":
          return `${event.partyName}が動いた！${event.actionName}：${target}が${amount}円を得た`;
        case "steal":
          return `${event.partyName}が動いた！${event.actionName}：${target}から${amount}円を奪った`;
      }
    }
    case "turn":
      return event.isSelf ? "あなたのターン" : `${event.playerName}のターン`;
    case "draw":
      return `${resolveName(event.playerId)}が${event.count}枚ドロー`;
  }
}

/**
 * An attack declaration in the combat log ("◯◯が△△で攻撃" before its damage
 * entry). The same predicate is used by `planDuels` to segment a delta.
 */
export function isAttackDeclarationLog(entry: BattleLogEntry): boolean {
  return (
    entry.kind === "attack" &&
    typeof entry.damage !== "number" &&
    /で攻撃/.test(entry.message)
  );
}

/** Index of the delta's first attack declaration, or the delta length. */
export function firstAttackLogIndex(
  previous: GameState,
  next: GameState,
): number {
  if (next.log.length < previous.log.length) return 0;
  const newEntries = next.log.slice(previous.log.length);
  const index = newEntries.findIndex(isAttackDeclarationLog);
  return index === -1 ? newEntries.length : index;
}

export interface SplitSupportEvents {
  /** Support events logged before the delta's first attack. */
  before: BattleEvent[];
  /** Everything else, in the order it was derived. */
  after: BattleEvent[];
}

/**
 * Split the delta's support events around its first attack.
 *
 * Trading happens on the player's own turn, so its "両替した" log entry always
 * precedes the opponent's attack declaration. Presenting the two in log order
 * keeps the exchange effect on the turn it belongs to instead of letting it
 * play after the opponent's duel. Support events that the log places *after*
 * the attack (the next turn's draw, heals, money) must stay after it.
 *
 * Only heal / mpRecover / money carry a log position; everything else is
 * returned in `after`.
 */
export function splitSupportEventsBeforeAttack(
  previous: GameState,
  next: GameState,
  events: BattleEvent[],
): SplitSupportEvents {
  const limit = firstAttackLogIndex(previous, next);
  const before: BattleEvent[] = [];
  const after: BattleEvent[] = [];
  for (const event of events) {
    const positioned =
      event.kind === "heal" ||
      event.kind === "mpRecover" ||
      event.kind === "money" ||
      event.kind === "party" ||
      event.kind === "partyAction";
    if (
      positioned &&
      typeof event.logIndex === "number" &&
      event.logIndex < limit
    ) {
      before.push(event);
    } else {
      after.push(event);
    }
  }
  return { before, after };
}

/** `◯◯が両替した (MP+2 / ￥+1 / HP-3)` → the stat changes it reports. */
function parseTradeParts(
  message: string,
): { mp: number; money: number; hp: number } | null {
  const mp = parseNumber(message, /MP([+-]\d+)/);
  const money = parseNumber(message, /￥([+-]\d+)/);
  const hp = parseNumber(message, /HP([+-]\d+)/);
  if (mp === null && money === null && hp === null) return null;
  return { mp: mp ?? 0, money: money ?? 0, hp: hp ?? 0 };
}

/**
 * Compare two authoritative game states and describe the changes as a short
 * sequence of presentation events.
 *
 * The states arrive from the server as a whole snapshot, so the deltas (log
 * entries, HP/MP/money, pendingAttack, active player) are the only source of
 * truth. The helper is pure so the ordering rules stay easy to reason about.
 */
export function deriveBattleEvents(
  previous: GameState | null,
  next: GameState,
  viewerId: PlayerId | null,
): BattleEvent[] {
  if (!previous) return [];
  if (previous.roomId !== next.roomId) return [];
  if (next.log.length < previous.log.length) return [];

  const newEntries = next.log.slice(previous.log.length);
  const previousPlayers = new Map(previous.players.map((player) => [player.id, player]));
  const nextPlayers = new Map(next.players.map((player) => [player.id, player]));

  const flights: BattleEvent[] = [];
  const supports: BattleEvent[] = [];
  const damages: BattleEvent[] = [];
  const turns: BattleEvent[] = [];

  const previousPending = previous.pendingAttack;
  const pending = next.pendingAttack;
  const defenseEntries = newEntries.filter((entry) => entry.kind === "defense");
  const defended = defenseEntries.length > 0;
  const damageEntries = newEntries.filter(
    (entry) => entry.kind === "attack" && typeof entry.damage === "number" && entry.damage > 0,
  );
  const consumedDamageEntries = new Set<BattleLogEntry>();

  // An attack was declared and is waiting for a defense decision.
  if (pending && !previousPending) {
    flights.push({
      kind: "attack",
      attackerId: pending.attackerId,
      defenderId: pending.defenderId,
      cardId: pending.card.id,
      cardName: pending.cardName,
      amount: pending.amount,
    });
  }

  // The pending attack was resolved. This is the only place that knows the
  // attack amount, defense power and final damage at the same time.
  if (previousPending && !pending) {
    const resolvedEntry = damageEntries.find((entry) => !consumedDamageEntries.has(entry));
    if (resolvedEntry) consumedDamageEntries.add(resolvedEntry);

    const previousDefender = previousPlayers.get(previousPending.defenderId);
    const nextDefender = nextPlayers.get(previousPending.defenderId);
    const hpLoss =
      previousDefender && nextDefender
        ? Math.max(0, previousDefender.hp - nextDefender.hp)
        : 0;
    const amount = resolvedEntry?.damage ?? hpLoss;

    damages.push({
      kind: "damage",
      playerId: previousPending.defenderId,
      attackerId: previousPending.attackerId,
      amount,
      defensePower: defended ? Math.max(0, previousPending.amount - amount) : null,
      defended,
      blocked: amount === 0 && defended,
      selfDamage: false,
      cardName: previousPending.cardName,
    });
  }

  // If the pending state never reached the client (both server messages were
  // batched), reconstruct the attack flight from the combat log.
  if (!previousPending && !pending && flights.length === 0) {
    const attack = damageEntries
      .map((entry) => ({
        entry,
        target: resolveLogTarget(entry, next.players),
      }))
      .find(({ entry, target }) => target && target.id !== entry.playerId);
    if (attack?.target) {
      const cardName = parseDamageCardName(attack.entry.message) ?? "攻撃";
      flights.push({
        kind: "attack",
        attackerId: attack.entry.playerId,
        defenderId: attack.target.id,
        cardId: cardIdFromLogName(cardName),
        cardName,
        amount: null,
      });
    } else {
      // A fully blocked defense produces no damage entry, so the attack entry
      // and the defense entries are the only hints that an attack happened.
      const attackEntry = newEntries.find(
        (entry) =>
          entry.kind === "attack" && !entry.damage && /攻撃/.test(entry.message),
      );
      const defenseEntry = defenseEntries[0];
      if (attackEntry && defenseEntry) {
        const cardName = parseAttackCardName(attackEntry.message) ?? "攻撃";
        flights.push({
          kind: "attack",
          attackerId: attackEntry.playerId,
          defenderId: defenseEntry.playerId,
          cardId: cardIdFromLogName(cardName),
          cardName,
          amount: null,
        });
      }
    }
  }

  // Coalesced fully blocked defense: shields were used but no damage entry
  // exists because the final damage was zero.
  if (defended && !previousPending) {
    const handled = new Set(
      damages.map((event) => (event.kind === "damage" ? event.playerId : "")),
    );
    const attackEntry = newEntries.find(
      (entry) => entry.kind === "attack" && !entry.damage && /攻撃/.test(entry.message),
    );
    for (const defenseEntry of defenseEntries) {
      if (handled.has(defenseEntry.playerId)) continue;
      const defender = nextPlayers.get(defenseEntry.playerId);
      const before = previousPlayers.get(defenseEntry.playerId);
      if (!defender || !before) continue;
      const tookDamage = damageEntries.some(
        (entry) => resolveLogTarget(entry, next.players)?.id === defender.id,
      );
      if (tookDamage || before.hp < defender.hp) continue;
      handled.add(defender.id);
      damages.push({
        kind: "damage",
        playerId: defender.id,
        attackerId: attackEntry?.playerId ?? null,
        amount: 0,
        defensePower: null,
        defended: true,
        blocked: true,
        selfDamage: false,
        cardName: attackEntry ? parseAttackCardName(attackEntry.message) : null,
      });
    }
  }

  // Every remaining damage log entry becomes an impact event. This covers
  // self-damage (axe), coalesced attacks and multi-target effects.
  for (const entry of damageEntries) {
    if (consumedDamageEntries.has(entry)) continue;
    const target = resolveLogTarget(entry, next.players);
    if (!target) continue;
    damages.push({
      kind: "damage",
      playerId: target.id,
      attackerId: entry.playerId,
      amount: entry.damage ?? 0,
      defensePower: null,
      defended,
      blocked: false,
      selfDamage: entry.playerId === target.id,
      cardName: parseDamageCardName(entry.message),
    });
  }

  const healedPlayers = new Set<PlayerId>();
  const recoveredPlayers = new Set<PlayerId>();
  const tradedPlayers = new Set<PlayerId>();

  newEntries.forEach((entry, index) => {
    if (entry.kind === "trade" && /両替した/.test(entry.message)) {
      // The exchange is a log entry of its own, so its effects belong at this
      // position in the delta (before the opponent's attack, not after it).
      const player = nextPlayers.get(entry.playerId);
      const parts = parseTradeParts(entry.message);
      if (!player || !parts) return;
      tradedPlayers.add(player.id);
      if (parts.mp > 0) {
        recoveredPlayers.add(player.id);
        supports.push({
          kind: "mpRecover",
          playerId: player.id,
          amount: parts.mp,
          cardName: null,
          logIndex: index,
        });
      }
      if (parts.money !== 0) {
        supports.push({
          kind: "money",
          playerId: player.id,
          delta: parts.money,
          logIndex: index,
        });
      }
      if (parts.hp > 0) {
        healedPlayers.add(player.id);
        supports.push({
          kind: "heal",
          playerId: player.id,
          amount: parts.hp,
          cardName: null,
          logIndex: index,
        });
      }
    }
  });

  for (const [index, entry] of newEntries.entries()) {
    if (entry.kind === "special" && /入党した|所属を変更した/.test(entry.message)) {
      // Joining a party changes no HP/MP/money, so the log entry is the only
      // trace of the action. It is positioned like an exchange: the join
      // happened on this turn and must play before the opponent's attack.
      const player = nextPlayers.get(entry.playerId);
      const parsed = parsePartyLog(entry.message, player?.name ?? null);
      if (parsed) {
        supports.push({
          kind: "party",
          playerId: entry.playerId,
          cardId: partyCardId(parsed.cardName, player?.party ?? null),
          cardName: parsed.cardName,
          previousPartyName: parsed.previousPartyName,
          logIndex: index,
        });
      }
      continue;
    }

    if (entry.kind === "special") {
      const action = parsePartyActionLog(entry.message, next.players);
      if (action) {
        // Party actions fire at the end of a turn, so the log position keeps
        // them after the attack they follow.
        supports.push({
          kind: "partyAction",
          playerId: entry.playerId,
          cardId: partyCardIdOrNull(action.partyName),
          partyName: action.partyName,
          actionName: action.actionName,
          targetId: action.targetId,
          effect: action.effect,
          logIndex: index,
        });
        continue;
      }
    }

    if (entry.kind === "heal") {
      const target =
        resolveLogTarget(entry, next.players) ??
        findPlayerByGain(entry, previousPlayers, nextPlayers, "hp");
      const amount =
        parseNumber(entry.message, /が(\d+)回復/) ??
        gainedBy(target, previousPlayers, "hp");
      if (target && amount > 0) {
        healedPlayers.add(target.id);
        supports.push({
          kind: "heal",
          playerId: target.id,
          amount,
          cardName: parseTrailingParen(entry.message),
        });
      }
      continue;
    }

    if (entry.kind === "mpRecover") {
      const target =
        resolveLogTarget(entry, next.players) ??
        findPlayerByGain(entry, previousPlayers, nextPlayers, "mp");
      const amount =
        parseNumber(entry.message, /MPが(\d+)回復/) ??
        gainedBy(target, previousPlayers, "mp");
      if (target && amount > 0) {
        recoveredPlayers.add(target.id);
        supports.push({
          kind: "mpRecover",
          playerId: target.id,
          amount,
          cardName: parseTrailingParen(entry.message),
        });
      }
      continue;
    }

    if (entry.kind === "system" && /枚ドロー/.test(entry.message)) {
      const count = parseNumber(entry.message, /が(\d+)枚ドロー/);
      const target = next.players.find((player) => player.id === entry.playerId);
      if (count && count > 0 && target && flights.length === 0 && damageEntries.length === 0) {
        supports.push({ kind: "draw", playerId: target.id, count });
      }
    }
  }

  // Positive HP/MP changes that had no dedicated log entry (e.g. exchange).
  for (const player of next.players) {
    const before = previousPlayers.get(player.id);
    if (!before) continue;
    if (tradedPlayers.has(player.id)) continue;
    if (!healedPlayers.has(player.id) && player.hp > before.hp) {
      supports.push({
        kind: "heal",
        playerId: player.id,
        amount: player.hp - before.hp,
        cardName: null,
      });
    }
    if (!recoveredPlayers.has(player.id) && player.mp > before.mp) {
      supports.push({
        kind: "mpRecover",
        playerId: player.id,
        amount: player.mp - before.mp,
        cardName: null,
      });
    }
    if (player.money !== before.money) {
      supports.push({
        kind: "money",
        playerId: player.id,
        delta: player.money - before.money,
      });
    }
  }

  if (!next.winner) {
    const active = next.players[next.activePlayerIndex];
    const previousActive = previous.players[previous.activePlayerIndex];
    if (active) {
      const activeChanged =
        previous.activePlayerIndex !== next.activePlayerIndex ||
        previousActive?.id !== active.id;
      // With one action per turn every turn end advances `actionTurn`, even
      // when no log entry describes the switch (a passed turn). A coalesced
      // delta can therefore end on the same active player: the round wrapped
      // around (or dead players were skipped) and this is a fresh turn, so it
      // gets the plain turn banner, never a "continued" one.
      if (activeChanged || next.actionTurn > previous.actionTurn) {
        turns.push({
          kind: "turn",
          playerId: active.id,
          playerName: active.name,
          isSelf: active.id === viewerId,
        });
      }
    }
  }

  const ordered = splitSupportEventsBeforeAttack(previous, next, supports);

  return [
    ...ordered.before,
    ...flights,
    ...ordered.after,
    ...damages,
    ...turns,
  ];
}

function resolveLogTarget(
  entry: BattleLogEntry,
  players: PlayerState[],
): PlayerState | null {
  const sorted = [...players].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find(
      (player) =>
        entry.message.includes(`${player.name}が`) ||
        entry.message.includes(`${player.name}のMPが`),
    ) ?? null
  );
}

function findPlayerByGain(
  entry: BattleLogEntry,
  previous: Map<PlayerId, PlayerState>,
  next: Map<PlayerId, PlayerState>,
  stat: "hp" | "mp",
): PlayerState | null {
  const candidates = [...next.values()]
    .filter((player) => player.name && entry.message.includes(player.name))
    .filter((player) => {
      const before = previous.get(player.id);
      return before ? player[stat] > before[stat] : false;
    });
  return candidates[0] ?? null;
}

function gainedBy(
  player: PlayerState | null,
  previous: Map<PlayerId, PlayerState>,
  stat: "hp" | "mp",
): number {
  if (!player) return 0;
  const before = previous.get(player.id);
  return before ? Math.max(0, player[stat] - before[stat]) : 0;
}

/** `◯◯が共産党に入党した` / `◯◯が自民党から共産党へ所属を変更した` */
function parsePartyLog(
  message: string,
  playerName: string | null,
): { cardName: string; previousPartyName: string | null } | null {
  const prefix = playerName ? `${playerName}が` : null;
  const rest =
    prefix && message.startsWith(prefix)
      ? message.slice(prefix.length)
      : message;
  const changed = /^(.+?)から(.+?)へ所属を変更した$/.exec(rest);
  if (changed?.[1] && changed[2]) {
    return {
      cardName: changed[2].trim(),
      previousPartyName: changed[1].trim(),
    };
  }
  const joined = /^(.+?)に入党した$/.exec(rest);
  if (joined?.[1]) {
    return { cardName: joined[1].trim(), previousPartyName: null };
  }
  return null;
}

/** Party name → party card id, falling back to the player's current party. */
function partyCardId(cardName: string, partyId: string | null): string {
  const card = BASE_CARDS.find(
    (definition) =>
      definition.category === "party" && definition.name === cardName,
  );
  return card?.id ?? partyId ?? cardName;
}

/** Party name → party card id, or `null` for an unknown label. */
function partyCardIdOrNull(cardName: string): string | null {
  return (
    BASE_CARDS.find(
      (definition) =>
        definition.category === "party" && definition.name === cardName,
    )?.id ?? null
  );
}

/**
 * `共産党が動いた！ 労働者の反撃: ボブに3ダメージ` and its four siblings.
 *
 * The five server shapes are damage / heal / mp / money / steal. Party actions
 * have no state of their own beyond the log line, so the whole event is parsed
 * from text.
 */
export function parsePartyActionLog(
  message: string,
  players: readonly { id: PlayerId; name: string }[],
): {
  partyName: string;
  actionName: string;
  targetId: PlayerId | null;
  effect: { kind: PartyActionKind; amount: number };
} | null {
  const head = /^(.+?)が動いた！ (.+?): (.+)$/.exec(message);
  if (!head?.[1] || !head[2] || !head[3]) return null;
  const partyName = head[1].trim();
  const actionName = head[2].trim();
  const body = head[3].trim();
  const idOf = (name: string): PlayerId | null =>
    players.find((player) => player.name === name)?.id ?? null;

  const damage = /^(.+?)に(\d+)ダメージ$/.exec(body);
  if (damage?.[1] && damage[2]) {
    return {
      partyName,
      actionName,
      targetId: idOf(damage[1].trim()),
      effect: { kind: "damage", amount: Number(damage[2]) },
    };
  }
  const heal = /^(.+?)のHPが(\d+)回復$/.exec(body);
  if (heal?.[1] && heal[2]) {
    return {
      partyName,
      actionName,
      targetId: idOf(heal[1].trim()),
      effect: { kind: "heal", amount: Number(heal[2]) },
    };
  }
  const mp = /^(.+?)のMPが(\d+)回復$/.exec(body);
  if (mp?.[1] && mp[2]) {
    return {
      partyName,
      actionName,
      targetId: idOf(mp[1].trim()),
      effect: { kind: "mp", amount: Number(mp[2]) },
    };
  }
  const money = /^(.+?)が(\d+)円を得た$/.exec(body);
  if (money?.[1] && money[2]) {
    return {
      partyName,
      actionName,
      targetId: idOf(money[1].trim()),
      effect: { kind: "money", amount: Number(money[2]) },
    };
  }
  const steal = /^(.+?)から(\d+)円を奪った$/.exec(body);
  if (steal?.[1] && steal[2]) {
    return {
      partyName,
      actionName,
      targetId: idOf(steal[1].trim()),
      effect: { kind: "steal", amount: Number(steal[2]) },
    };
  }
  return null;
}

function parseNumber(message: string, pattern: RegExp): number | null {
  const match = pattern.exec(message);
  const value = match?.[1];
  return value ? Number(value) : null;
}

function parseTrailingParen(message: string): string | null {
  const match = /\(([^()]*)\)\s*$/.exec(message);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function parseDamageCardName(message: string): string | null {
  return parseTrailingParen(message);
}

function parseAttackCardName(message: string): string | null {
  const match = /が(.+?)で攻撃/.exec(message);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/**
 * Resolve a card id from the card name in the combat log.
 *
 * Duplicated from `cardIdFromLogName` in battleSequence: battleSequence already
 * imports from this module, so importing back would create a cycle. Combined
 * attacks are logged as `A+B`; the primary card is the first name.
 */
function cardIdFromLogName(name: string | null): string | null {
  const primary = name?.split("+")[0]?.trim();
  if (!primary) return null;
  return BASE_CARDS.find((card) => card.name === primary)?.id ?? null;
}
