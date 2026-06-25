"use client";

import { TopBar } from "../../_components/TopBar";

interface HeaderProps {
  actionTurn: number;
  onLeave: () => void;
}

export function Header({ actionTurn, onLeave }: HeaderProps) {
  return (
    <TopBar
      title={`G.F.${actionTurn}`}
      rightAction={{ label: "退出", icon: "🚪", onClick: onLeave }}
    />
  );
}
