"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ClientMessage, GameState, ServerMessage } from "@volga/shared";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

export type PlayerId = string;

export interface GameContextValue {
  status: ConnectionStatus;
  playerId: PlayerId | null;
  gameState: GameState | null;
  lastMessage: ServerMessage | null;
  lastError: string | null;
  send: (msg: ClientMessage) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function getDefaultUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:4000";
  const host = window.location.hostname;
  return `ws://${host}:4000`;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const url = getDefaultUrl();

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus("connecting");

      ws.addEventListener("open", () => {
        if (cancelled) return;
        setStatus("connected");
        reconnectRef.current = 0;
      });

      ws.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(e.data) as ServerMessage;
          if (msg.type === "connected") {
            setPlayerId(msg.playerId);
          }
          if (
            msg.type === "room_created" ||
            msg.type === "room_joined" ||
            msg.type === "game_started" ||
            msg.type === "game_state"
          ) {
            setGameState(msg.gameState);
          }
          if (msg.type === "error") {
            setLastError(msg.message);
          }
          setLastMessage(msg);
        } catch {
          // ignore parse error
        }
      });

      ws.addEventListener("close", () => {
        if (cancelled) return;
        setStatus("disconnected");
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 8000);
        reconnectRef.current += 1;
        setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });
    }

    connect();

    return () => {
      cancelled = true;
      // Intentionally do not close the WebSocket.
      // It persists across navigations so the server-side room survives.
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return (
    <GameContext.Provider
      value={{ status, playerId, gameState, lastMessage, lastError, send }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameSocket(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGameSocket must be used within GameProvider");
  }
  return ctx;
}