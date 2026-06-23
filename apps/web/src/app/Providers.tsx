"use client";

import { GameProvider } from "@/lib/GameContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}