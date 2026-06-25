"use client";

import { TopBar } from "../../_components/TopBar";

interface HeaderProps {
  actionTurn: number;
  onBack: () => void;
}

export function Header({ actionTurn, onBack }: HeaderProps) {
  return (
    <TopBar
      title={`G.F.${actionTurn}`}
      onBack={onBack}
    />
  );
}
