import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { INITIAL_HAND_SIZE, createGame, findCard } from "@volga/game-core";
import type { GameState, PlayerState, ServerMessage } from "@volga/shared";
import { finishTurn, startServer } from "./index.js";
import { createRoom, type Room } from "./room.js";

const MESSAGE_TIMEOUT_MS = 4000;

interface Waiter {
  predicate: (msg: ServerMessage) => boolean;
  resolve: (msg: ServerMessage) => void;
  timer: NodeJS.Timeout;
}

class TestClient {
  readonly ws: WebSocket;
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: Waiter[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      const waiterIndex = this.waiters.findIndex((waiter) => waiter.predicate(msg));
      if (waiterIndex === -1) {
        this.queue.push(msg);
        return;
      }
      const [waiter] = this.waiters.splice(waiterIndex, 1);
      // Messages queued before this one are older and must be consumed in order.
      this.queue.length = 0;
      clearTimeout(waiter!.timer);
      waiter!.resolve(msg);
    });
  }

  static async connect(port: number): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const client = new TestClient(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    return client;
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolves with the next message matching the predicate, discarding older ones. */
  next(
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs = MESSAGE_TIMEOUT_MS,
  ): Promise<ServerMessage> {
    const queuedIndex = this.queue.findIndex(predicate);
    if (queuedIndex !== -1) {
      const msg = this.queue[queuedIndex]!;
      this.queue.splice(0, queuedIndex + 1);
      return Promise.resolve(msg);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter.timer === timer);
        if (index !== -1) this.waiters.splice(index, 1);
        const recent = this.queue.map((msg) => msg.type).slice(-5).join(", ");
        reject(
          new Error(
            `timed out after ${timeoutMs}ms waiting for server message` +
              (recent ? ` (queued: ${recent})` : ""),
          ),
        );
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, timer });
    });
  }

  async ping(): Promise<void> {
    this.send({ type: "ping" });
    await this.next((msg) => msg.type === "pong");
  }

  close(): void {
    this.ws.close();
  }
}

function attackPower(cardId: string): number {
  const card = findCard(cardId);
  if (!card) return 0;
  if (card.category === "trade" || card.category === "party") return 0;
  if (card.effects.every((effect) => effect.kind === "defense")) return 0;
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "attack_power") return total + (effect.amount ?? 0);
    if (effect.kind === "damage" && effect.target === "opponent") {
      return total + (effect.amount ?? 0);
    }
    return total;
  }, 0);
}

function selfDamage(cardId: string): number {
  const card = findCard(cardId);
  if (!card) return 0;
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "damage" && effect.target === "self") {
      return total + (effect.amount ?? 0);
    }
    return total;
  }, 0);
}

function isPlayable(cardId: string, mp: number): boolean {
  const card = findCard(cardId);
  if (!card) return false;
  if (card.category === "trade" || card.category === "party") return false;
  if (card.effects.every((effect) => effect.kind === "defense")) return false;
  if (card.category === "miracle" && (card.mpCost ?? 0) > mp) return false;
  return true;
}

/** 最も弱い攻撃カードを選ぶ（勝敗が意図せず決まらないようにする）。 */
function pickAttackCard(player: PlayerState): string | null {
  return (
    [...player.hand]
      .filter((cardRef) => attackPower(cardRef.id) > 0)
      .sort(
        (a, b) =>
          attackPower(a.id) + selfDamage(a.id) - (attackPower(b.id) + selfDamage(b.id)),
      )[0]?.id ?? null
  );
}

/** 決着をつけるための、MP が足りる中で最も強い攻撃カード。 */
function pickStrongestAttackCard(player: PlayerState): string | null {
  return (
    [...player.hand]
      .filter((cardRef) => attackPower(cardRef.id) > 0 && isPlayable(cardRef.id, player.mp))
      .sort((a, b) => attackPower(b.id) - attackPower(a.id))[0]?.id ?? null
  );
}

function pickNonAttackCard(player: PlayerState): string | null {
  return (
    player.hand.find((cardRef) => {
      const card = findCard(cardRef.id);
      if (!card) return false;
      if (card.category === "party") return false;
      if (attackPower(cardRef.id) > 0) return false;
      // 自傷で決着してしまうカードは避ける（ターン終了の検証にならない）。
      if (selfDamage(cardRef.id) > 0) return false;
      return isPlayable(cardRef.id, player.mp);
    })?.id ?? null
  );
}

interface TrainingRoomInfo {
  state: GameState;
  humanId: string;
  aiId: string;
  humanIndex: number;
  aiIndex: number;
}

async function findTrainingRoom(
  client: TestClient,
  check: (human: PlayerState, ai: PlayerState) => boolean,
  attempts = 400,
): Promise<TrainingRoomInfo> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    client.send({ type: "create_room", playerName: "Human", mode: "training" });
    const created = await client.next((msg) => msg.type === "room_created");
    assert.equal(created.type, "room_created");
    if (created.type !== "room_created") throw new Error("unreachable");

    const state = created.gameState;
    const humanIndex = state.activePlayerIndex;
    const human = state.players[humanIndex]!;
    const ai = state.players.find((player) => player.id !== human.id)!;
    if (check(human, ai)) {
      return {
        state,
        humanId: human.id,
        aiId: ai.id,
        humanIndex,
        aiIndex: state.players.findIndex((player) => player.id === ai.id),
      };
    }

    client.send({ type: "leave_room" });
    await client.ping();
    // 初期手札はランダム抽選なので、条件に合う手札を引けるまで少し待って作り直す。
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  assert.fail("could not find a training room matching the required setup");
}

async function createTrainingRoom(
  client: TestClient,
  selectCard: (human: PlayerState) => string | null,
): Promise<TrainingRoomInfo & { cardId: string }> {
  let selected: string | null = null;
  const room = await findTrainingRoom(client, (human) => {
    const cardId = selectCard(human);
    if (!cardId) return false;
    selected = cardId;
    return true;
  });
  assert.ok(selected, "could not find the required card in the opening hand");
  return { ...room, cardId: selected! };
}

interface VersusRoomInfo {
  aState: GameState;
  bState: GameState;
}

/** 対人ルームを作り、両者の game_started を待つ。 */
async function openVersusRoom(
  a: TestClient,
  b: TestClient,
): Promise<VersusRoomInfo> {
  const roomId = `versus_${Math.random().toString(36).slice(2, 8)}`;
  a.send({ type: "create_room", playerName: "A", roomId, mode: "versus" });
  const created = await a.next((msg) => msg.type === "room_created");
  assert.equal(created.type, "room_created");
  if (created.type !== "room_created") throw new Error("unreachable");

  b.send({ type: "join_room", roomId, playerName: "B" });
  const joined = await b.next((msg) => msg.type === "room_joined");
  assert.equal(joined.type, "room_joined");
  if (joined.type !== "room_joined") throw new Error("unreachable");

  a.send({ type: "ready" });
  b.send({ type: "ready" });
  const [aStarted, bStarted] = await Promise.all([
    a.next((msg) => msg.type === "game_started"),
    b.next((msg) => msg.type === "game_started"),
  ]);
  assert.equal(aStarted.type, "game_started");
  assert.equal(bStarted.type, "game_started");
  if (aStarted.type !== "game_started" || bStarted.type !== "game_started") {
    throw new Error("unreachable");
  }
  // 開始直後の game_state も消費して、クライアントの受信キューを空にしておく。
  const [aInitial, bInitial] = await Promise.all([
    a.next((msg) => msg.type === "game_state" && msg.gameState.phase === "play"),
    b.next((msg) => msg.type === "game_state" && msg.gameState.phase === "play"),
  ]);
  assert.equal(aInitial.type, "game_state");
  assert.equal(bInitial.type, "game_state");
  if (aInitial.type !== "game_state" || bInitial.type !== "game_state") {
    throw new Error("unreachable");
  }
  return { aState: aInitial.gameState, bState: bInitial.gameState };
}

async function closeVersusRoom(a: TestClient, b: TestClient): Promise<void> {
  a.send({ type: "leave_room" });
  b.send({ type: "leave_room" });
  await Promise.all([a.ping(), b.ping()]);
}

test("training mode ends the attacker's turn after the AI defender resolves", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, pickAttackCard);
  const initialActionTurn = room.state.actionTurn;

  client.send({
    type: "play_card",
    cardRef: { id: room.cardId },
    targetPlayerId: room.aiId,
  });

  const pendingDefense = await client.next(
    (msg) => msg.type === "game_state" && msg.gameState.phase === "defense",
  );
  assert.equal(pendingDefense.type, "game_state");
  if (pendingDefense.type !== "game_state") return;
  assert.equal(pendingDefense.gameState.pendingAttack?.attackerId, room.humanId);
  assert.equal(pendingDefense.gameState.pendingAttack?.defenderId, room.aiId);

  // 1通目: 防御解決直後。まだ攻撃者の手番のまま。
  const resolved = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.phase === "play" &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(resolved.type, "game_state");
  if (resolved.type !== "game_state") return;
  assert.equal(resolved.gameState.activePlayerIndex, room.humanIndex);
  assert.equal(resolved.gameState.actionTurn, initialActionTurn);
  assert.equal(resolved.gameState.players[room.humanIndex]!.id, room.humanId);
  assert.equal(resolved.gameState.winner, null);

  // 2通目: ターン終了後。手番が人間から移り、使った1枚ぶん引かれている。
  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.activePlayerIndex !== room.humanIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  assert.notEqual(ended.gameState.activePlayerIndex, room.humanIndex);
  assert.equal(ended.gameState.actionTurn, initialActionTurn + 1);
  assert.equal(ended.gameState.players[room.humanIndex]!.id, room.humanId);
  // 初期手札は9枚。1枚使ったので1枚引いて9枚に戻る。
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE,
  );
  assert.equal(ended.gameState.winner, null);
});

test("non-attack cards also end the turn", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, pickNonAttackCard);
  const initialActionTurn = room.state.actionTurn;

  client.send({ type: "play_card", cardRef: { id: room.cardId } });

  // 1通目: 効果解決直後。まだ手番は人間のまま。
  const effect = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(effect.type, "game_state");
  if (effect.type !== "game_state") return;
  assert.equal(effect.gameState.phase, "play");
  assert.equal(effect.gameState.activePlayerIndex, room.humanIndex);

  // 2通目: ターン終了後。手番が移り、使った1枚ぶん引かれる。
  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  assert.equal(ended.gameState.winner, null);
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE,
    "one card was used, so one card is drawn",
  );
});

test("join-party cards end the turn", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, (human) =>
    human.hand.find((cardRef) => findCard(cardRef.id)?.category === "party")?.id ?? null,
  );
  const initialActionTurn = room.state.actionTurn;

  client.send({ type: "play_card", cardRef: { id: room.cardId } });

  const effect = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(effect.type, "game_state");
  if (effect.type !== "game_state") return;
  assert.ok(
    effect.gameState.players[room.humanIndex]!.party,
    "the human should have joined a party",
  );

  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  assert.equal(ended.gameState.winner, null);
});

test("discarding cards ends the turn", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await findTrainingRoom(client, () => true);
  const initialActionTurn = room.state.actionTurn;
  const hand = room.state.players[room.humanIndex]!.hand;
  assert.ok(hand.length >= 3);

  client.send({
    type: "discard_cards",
    cardRefs: hand.slice(0, 3).map((card) => ({ id: card.id })),
  });

  const effect = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn &&
      msg.gameState.players[room.humanIndex]!.hand.length === hand.length - 3,
  );
  assert.equal(effect.type, "game_state");
  if (effect.type !== "game_state") return;
  assert.equal(effect.gameState.activePlayerIndex, room.humanIndex);

  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  // 3枚捨てたので3枚引く。
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE,
  );
  assert.ok(
    ended.gameState.log.some((entry) => entry.message.includes("3枚ドロー")),
  );
});

test("exchanging stats ends the turn", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, (human) =>
    human.hand.find((cardRef) => cardRef.id === "exchange")?.id ?? null,
  );
  const initialActionTurn = room.state.actionTurn;

  client.send({ type: "exchange_stats", mpDelta: 1, moneyDelta: 0 });

  const effect = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(effect.type, "game_state");
  if (effect.type !== "game_state") return;
  assert.equal(effect.gameState.activePlayerIndex, room.humanIndex);

  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  // 両替カード1枚を使ったので1枚引く。
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE,
  );
  assert.ok(
    ended.gameState.log.some((entry) => entry.message.includes("1枚ドロー")),
  );
  assert.equal(ended.gameState.winner, null);
});

test("buying ends the turn after the confirmation", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, (human) =>
    human.hand.find((cardRef) => cardRef.id === "buy")?.id ?? null,
  );
  const initialActionTurn = room.state.actionTurn;

  client.send({
    type: "buy_card",
    cardRef: { id: room.cardId },
    targetPlayerId: room.aiId,
  });

  // 買うカードを使っただけではまだターンは終わらない（購入者の決定待ち）。
  const pending = await client.next(
    (msg) => msg.type === "game_state" && msg.gameState.pendingBuy !== null,
  );
  assert.equal(pending.type, "game_state");
  if (pending.type !== "game_state") return;
  assert.equal(pending.gameState.actionTurn, initialActionTurn);
  assert.equal(pending.gameState.activePlayerIndex, room.humanIndex);

  client.send({ type: "confirm_buy", accept: true });

  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.pendingBuy === null &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  // 買いは0枚使用扱いなので、攻撃ターンの最低1枚が引かれる。
  // 買う札は buy_card の時点で手札から出て、買ったカード1枚が加わる。
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE + 1,
  );
  assert.ok(
    ended.gameState.log.some((entry) => entry.message.includes("1枚ドロー")),
  );
  assert.equal(ended.gameState.winner, null);
});

test("selling two cards draws two cards", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client, (human) => {
    const hasSell = human.hand.some((cardRef) => cardRef.id === "sell");
    return hasSell && human.hand.length >= 4 ? "sell" : null;
  });
  const initialActionTurn = room.state.actionTurn;
  const hand = room.state.players[room.humanIndex]!.hand;
  const sold = hand.filter((card) => card.id !== "sell").slice(0, 2);

  client.send({
    type: "sell_cards",
    cardRefs: sold.map((card) => ({ id: card.id })),
    targetPlayerId: room.aiId,
  });

  const ended = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1 &&
      msg.gameState.activePlayerIndex === room.aiIndex,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  // 9枚 - 売った2枚 - 売るカード1枚 + 2枚ドロー = 8枚
  assert.equal(
    ended.gameState.players[room.humanIndex]!.hand.length,
    INITIAL_HAND_SIZE - 1,
  );
  assert.ok(
    ended.gameState.log.some((entry) => entry.message.includes("2枚ドロー")),
  );
});

test("a resolved attack ends the attacker's turn in versus mode", async (t) => {
  const server = await startServer({ port: 0 });
  const attacker = await TestClient.connect(server.port);
  const defender = await TestClient.connect(server.port);
  t.after(async () => {
    attacker.close();
    defender.close();
    await server.close();
  });

  let setup: (VersusRoomInfo & { attackCardId: string }) | null = null;
  for (let attempt = 0; attempt < 10 && !setup; attempt += 1) {
    const room = await openVersusRoom(attacker, defender);
    const attackCardId = pickAttackCard(room.aState.players[0]!);
    if (attackCardId) {
      setup = { ...room, attackCardId };
    } else {
      await closeVersusRoom(attacker, defender);
    }
  }
  assert.ok(setup, "could not find an attack card for the host");
  if (!setup) return;

  const initialActionTurn = setup.aState.actionTurn;
  const attackerId = setup.aState.players[0]!.id;
  const defenderId = setup.aState.players[1]!.id;

  attacker.send({
    type: "play_card",
    cardRef: { id: setup.attackCardId },
    targetPlayerId: defenderId,
  });

  const pendingDefense = await defender.next(
    (msg) => msg.type === "game_state" && msg.gameState.phase === "defense",
  );
  assert.equal(pendingDefense.type, "game_state");
  if (pendingDefense.type !== "game_state") return;
  assert.equal(pendingDefense.gameState.pendingAttack?.attackerId, attackerId);
  assert.equal(pendingDefense.gameState.pendingAttack?.defenderId, defenderId);

  defender.send({ type: "defend", cardRefs: [] });

  const resolved = await defender.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.phase === "play" &&
      msg.gameState.pendingAttack === null &&
      msg.gameState.actionTurn === initialActionTurn,
  );
  assert.equal(resolved.type, "game_state");
  if (resolved.type !== "game_state") return;
  assert.equal(resolved.gameState.activePlayerIndex, 0);
  assert.equal(resolved.gameState.winner, null);

  const ended = await attacker.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.actionTurn === initialActionTurn + 1,
  );
  assert.equal(ended.type, "game_state");
  if (ended.type !== "game_state") return;
  assert.equal(ended.gameState.activePlayerIndex, 1);
  assert.equal(ended.gameState.players[1]!.id, defenderId);
  // 初期手札は9枚。攻撃カード1枚を使ったので1枚引いて9枚に戻る。
  assert.equal(ended.gameState.players[0]!.hand.length, INITIAL_HAND_SIZE);
  assert.equal(ended.gameState.winner, null);

  // 攻撃者はもう自分の手番ではないので play_card できない。
  const cardInHand = ended.gameState.players[0]!.hand[0]!;
  attacker.send({
    type: "play_card",
    cardRef: { id: cardInHand.id },
    targetPlayerId: defenderId,
  });
  const error = await attacker.next((msg) => msg.type === "error");
  assert.equal(error.type, "error");
  if (error.type !== "error") return;
  assert.equal(error.message, "not your turn");
});

test("a winning attack does not advance the turn (versus)", async (t) => {
  const server = await startServer({ port: 0 });
  const attacker = await TestClient.connect(server.port);
  const defender = await TestClient.connect(server.port);
  t.after(async () => {
    attacker.close();
    defender.close();
    await server.close();
  });

  type Setup = VersusRoomInfo & { attackCardId: string; attackerId: string; defenderId: string };
  let setup: Setup | null = null;
  for (let attempt = 0; attempt < 20 && !setup; attempt += 1) {
    const room = await openVersusRoom(attacker, defender);
    const host = room.aState.players[0]!;
    const guest = room.aState.players[1]!;
    const attackCardId = pickStrongestAttackCard(host);
    if (attackCardId) {
      setup = {
        ...room,
        attackCardId,
        attackerId: host.id,
        defenderId: guest.id,
      };
    } else {
      await closeVersusRoom(attacker, defender);
    }
  }
  assert.ok(setup, "could not find an attack card for the host");
  if (!setup) return;

  // 攻撃を繰り返して防御者を倒す。決着したらターンが進まないことを確認する。
  let current = setup.aState;
  let actionTurnBeforeFinalAttack = 0;
  let finalState: GameState | null = null;

  for (let round = 0; round < 60 && !finalState; round += 1) {
    const actionTurn = current.actionTurn;
    const attackCardId = pickStrongestAttackCard(current.players[0]!);

    if (!attackCardId) {
      // 攻撃カードが無いときは手札を捨てて引き直し、次の攻撃の機会を作る。
      const hand = current.players[0]!.hand.map((cardRef) => cardRef.id);
      attacker.send({
        type: "discard_cards",
        cardRefs: hand.map((id) => ({ id })),
      });
      const discarded = await attacker.next(
        (msg) =>
          msg.type === "game_state" && msg.gameState.players[0]!.hand.length === 0,
      );
      assert.equal(discarded.type, "game_state");
      if (discarded.type !== "game_state") return;

      attacker.send({ type: "end_turn" });
      const defenderTurn = await attacker.next(
        (msg) =>
          msg.type === "game_state" &&
          msg.gameState.activePlayerIndex === 1 &&
          msg.gameState.actionTurn === actionTurn + 1,
      );
      assert.equal(defenderTurn.type, "game_state");
      if (defenderTurn.type !== "game_state") return;

      defender.send({ type: "end_turn" });
      const attackerTurn = await attacker.next(
        (msg) =>
          msg.type === "game_state" &&
          msg.gameState.activePlayerIndex === 0 &&
          msg.gameState.actionTurn === actionTurn + 2,
      );
      assert.equal(attackerTurn.type, "game_state");
      if (attackerTurn.type !== "game_state") return;
      current = attackerTurn.gameState;
      continue;
    }

    attacker.send({
      type: "play_card",
      cardRef: { id: attackCardId },
      targetPlayerId: setup.defenderId,
    });

    const pendingDefense = await defender.next(
      (msg) => msg.type === "game_state" && msg.gameState.phase === "defense",
    );
    assert.equal(pendingDefense.type, "game_state");
    if (pendingDefense.type !== "game_state") return;

    defender.send({ type: "defend", cardRefs: [] });

    const resolved = await attacker.next(
      (msg) =>
        msg.type === "game_state" &&
        msg.gameState.phase === "play" &&
        msg.gameState.pendingAttack === null &&
        msg.gameState.actionTurn === actionTurn,
    );
    assert.equal(resolved.type, "game_state");
    if (resolved.type !== "game_state") return;

    if (resolved.gameState.winner) {
      finalState = resolved.gameState;
      actionTurnBeforeFinalAttack = actionTurn;
      break;
    }

    // 攻撃後は自動でターンが終わり、防御者の手番になる。
    const defenderTurn = await attacker.next(
      (msg) =>
        msg.type === "game_state" &&
        msg.gameState.activePlayerIndex === 1 &&
        msg.gameState.actionTurn === actionTurn + 1,
    );
    assert.equal(defenderTurn.type, "game_state");
    if (defenderTurn.type !== "game_state") return;

    defender.send({ type: "end_turn" });
    const attackerTurn = await attacker.next(
      (msg) =>
        msg.type === "game_state" &&
        msg.gameState.activePlayerIndex === 0 &&
        msg.gameState.actionTurn === actionTurn + 2,
    );
    assert.equal(attackerTurn.type, "game_state");
    if (attackerTurn.type !== "game_state") return;
    current = attackerTurn.gameState;
  }

  assert.ok(finalState, "the attacker never won");
  if (!finalState) return;
  assert.equal(finalState.winner, setup.attackerId);
  assert.equal(finalState.activePlayerIndex, 0);
  assert.equal(finalState.actionTurn, actionTurnBeforeFinalAttack);
  assert.equal(finalState.players.find((p) => p.id === setup!.defenderId)!.hp, 0);
});

test("finishTurn refuses to advance the turn after victory or during defense", () => {
  const room: Room = createRoom("finish-turn-room", {
    id: "p1",
    ws: null,
    name: "A",
    ready: true,
  });
  room.players.push({ id: "p2", ws: null, name: "B", ready: true, ai: true });
  const created = createGame(
    room.id,
    room.players.map((p) => ({ id: p.id, name: p.name })),
  );
  room.gameState = { ...created.state, winner: "p1" };
  room.started = true;

  assert.equal(finishTurn(room), false);
  assert.equal(room.gameState.activePlayerIndex, 0);
  assert.equal(room.gameState.actionTurn, 1);
  assert.equal(room.gameState.winner, "p1");

  room.gameState = {
    ...created.state,
    phase: "defense",
    pendingAttack: {
      attackerId: "p1",
      defenderId: "p2",
      card: { id: "fire" },
      cardName: "ファイア",
      amount: 4,
    },
  };
  assert.equal(finishTurn(room), false);
  assert.equal(room.gameState.activePlayerIndex, 0);
  assert.equal(room.gameState.actionTurn, 1);
});
