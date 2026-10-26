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

export interface HealEvent {
  kind: "heal";
  playerId: PlayerId;
  amount: number;
  cardName: string | null;
}

export interface MpRecoverEvent {
  kind: "mpRecover";
  playerId: PlayerId;
  amount: number;
  cardName: string | null;
}

export interface MoneyEvent {
  kind: "money";
  playerId: PlayerId;
  delta: number;
}

export interface TurnEvent {
  kind: "turn";
  playerId: PlayerId;
  playerName: string;
  isSelf: boolean;
  /** A full round was coalesced into one state update (turns were skipped). */
  continuation: boolean;
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
  | TurnEvent
  | DrawEvent;

export interface PresentedBattleEvent {
  event: BattleEvent;
  key: number;
}

const EVENT_DURATION: Record<BattleEvent["kind"], number> = {
  attack: 620,
  damage: 720,
  heal: 650,
  mpRecover: 650,
  money: 600,
  turn: 750,
  draw: 520,
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
    case "turn":
    case "draw":
      return event.playerId === playerId;
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
    case "turn":
      return event.isSelf ? "あなたのターン" : `${event.playerName}のターン`;
    case "draw":
      return `${resolveName(event.playerId)}が${event.count}枚ドロー`;
  }
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
      flights.push({
        kind: "attack",
        attackerId: attack.entry.playerId,
        defenderId: attack.target.id,
        cardId: null,
        cardName: parseDamageCardName(attack.entry.message) ?? "攻撃",
        amount: null,
      });
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

  for (const entry of newEntries) {
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
      if (activeChanged) {
        turns.push({
          kind: "turn",
          playerId: active.id,
          playerName: active.name,
          isSelf: active.id === viewerId,
          continuation: false,
        });
      } else if (next.actionTurn > previous.actionTurn) {
        turns.push({
          kind: "turn",
          playerId: active.id,
          playerName: active.name,
          isSelf: active.id === viewerId,
          continuation: true,
        });
      }
    }
  }

  return [...flights, ...supports, ...damages, ...turns];
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
