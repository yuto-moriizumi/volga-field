import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { findCard } from "@volga/game-core";
import type { GameState, ServerMessage } from "@volga/shared";
import { startServer } from "./index.js";

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

async function createTrainingRoom(client: TestClient): Promise<{
  state: GameState;
  humanId: string;
  aiId: string;
  attackCardId: string;
}> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    client.send({ type: "create_room", playerName: "Human", mode: "training" });
    const created = await client.next((msg) => msg.type === "room_created");
    assert.equal(created.type, "room_created");
    if (created.type !== "room_created") throw new Error("unreachable");

    const state = created.gameState;
    const human = state.players[state.activePlayerIndex]!;
    const ai = state.players.find((player) => player.id !== human.id)!;
    const attackCardId =
      [...human.hand]
        .filter((cardRef) => attackPower(cardRef.id) > 0)
        .sort(
          (a, b) =>
            attackPower(a.id) +
            selfDamage(a.id) -
            (attackPower(b.id) + selfDamage(b.id)),
        )[0]?.id ?? null;
    if (attackCardId) {
      return { state, humanId: human.id, aiId: ai.id, attackCardId };
    }

    client.send({ type: "leave_room" });
    await client.ping();
  }
  assert.fail("could not find an attack card in the opening hand");
}

async function expectStillActive(
  client: TestClient,
  message: string,
): Promise<void> {
  client.send({ type: "play_card", cardRef: { id: "__missing_card__" } });
  const error = await client.next((msg) => msg.type === "error");
  assert.equal(error.type, "error");
  if (error.type !== "error") return;
  assert.equal(
    error.message,
    "unknown card",
    `${message}: expected the human to remain active, got "${error.message}"`,
  );
}

test("training mode lets the human keep playing after the AI defender resolves", async (t) => {
  const server = await startServer({ port: 0 });
  const client = await TestClient.connect(server.port);
  t.after(async () => {
    client.close();
    await server.close();
  });

  const room = await createTrainingRoom(client);
  const humanIndex = room.state.activePlayerIndex;
  const initialActionTurn = room.state.actionTurn;

  client.send({
    type: "play_card",
    cardRef: { id: room.attackCardId },
    targetPlayerId: room.aiId,
  });

  const pendingDefense = await client.next(
    (msg) => msg.type === "game_state" && msg.gameState.phase === "defense",
  );
  assert.equal(pendingDefense.type, "game_state");
  if (pendingDefense.type !== "game_state") return;
  assert.equal(pendingDefense.gameState.pendingAttack?.attackerId, room.humanId);
  assert.equal(pendingDefense.gameState.pendingAttack?.defenderId, room.aiId);

  const resolved = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.phase === "play" &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(resolved.type, "game_state");
  if (resolved.type !== "game_state") return;
  assert.equal(resolved.gameState.activePlayerIndex, humanIndex);
  assert.equal(resolved.gameState.actionTurn, initialActionTurn);
  assert.equal(resolved.gameState.players[humanIndex]!.id, room.humanId);
  assert.equal(resolved.gameState.winner, null);

  // The key regression: asking to play again must not produce "not your turn".
  await expectStillActive(client, "after the AI defended");

  const human = resolved.gameState.players[humanIndex]!;
  const ai = resolved.gameState.players.find((player) => player.id === room.aiId)!;
  const playable = human.hand.filter((cardRef) => isPlayable(cardRef.id, human.mp));
  const secondCardId =
    playable.find((cardRef) => attackPower(cardRef.id) === 0 && selfDamage(cardRef.id) === 0)
      ?.id ??
    playable.find((cardRef) => attackPower(cardRef.id) === 0)?.id ??
    playable.find(
      (cardRef) => attackPower(cardRef.id) < ai.hp && selfDamage(cardRef.id) === 0,
    )?.id ??
    playable[0]?.id ??
    null;
  assert.ok(secondCardId, "expected another playable card in hand");

  client.send({
    type: "play_card",
    cardRef: { id: secondCardId },
    targetPlayerId: room.aiId,
  });
  const afterSecondPlay = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.phase === "play" &&
      msg.gameState.pendingAttack === null,
  );
  assert.equal(afterSecondPlay.type, "game_state");
  if (afterSecondPlay.type !== "game_state") return;
  assert.equal(afterSecondPlay.gameState.activePlayerIndex, humanIndex);
  assert.equal(afterSecondPlay.gameState.actionTurn, initialActionTurn);

  // Playing a second card must not auto-end the turn either.
  await expectStillActive(client, "after a second card");

  client.send({ type: "end_turn" });
  const aiTurn = await client.next(
    (msg) =>
      msg.type === "game_state" &&
      msg.gameState.activePlayerIndex !== humanIndex,
  );
  assert.equal(aiTurn.type, "game_state");
  if (aiTurn.type !== "game_state") return;
  assert.equal(aiTurn.gameState.actionTurn, initialActionTurn + 1);

  const aiOutcome = await client.next((msg) => {
    if (msg.type !== "game_state") return false;
    if (msg.gameState.winner) return true;
    if (
      msg.gameState.phase === "defense" &&
      msg.gameState.pendingAttack?.attackerId === room.aiId
    ) {
      return true;
    }
    return msg.gameState.activePlayerIndex === humanIndex;
  });
  assert.equal(aiOutcome.type, "game_state");
  if (aiOutcome.type !== "game_state") return;
  assert.equal(aiOutcome.gameState.winner, null);

  if (
    aiOutcome.gameState.phase === "defense" &&
    aiOutcome.gameState.pendingAttack?.attackerId === room.aiId
  ) {
    // The AI attacked; defend with no cards so it can finish its turn.
    client.send({ type: "defend", cardRefs: [] });
    const backToHuman = await client.next(
      (msg) =>
        msg.type === "game_state" &&
        msg.gameState.phase === "play" &&
        msg.gameState.activePlayerIndex === humanIndex,
    );
    assert.equal(backToHuman.type, "game_state");
    if (backToHuman.type !== "game_state") return;
    assert.equal(backToHuman.gameState.actionTurn, initialActionTurn + 2);
  } else {
    assert.equal(aiOutcome.gameState.activePlayerIndex, humanIndex);
    assert.equal(aiOutcome.gameState.actionTurn, initialActionTurn + 2);
  }
});
