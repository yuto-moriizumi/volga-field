"use client";

export function NamePlate({
  label,
  name,
  tone,
  compact = false,
  playerId,
  active = false,
  flash = false,
  dataStep,
}: {
  label: string;
  name: string;
  tone: "teal" | "blue";
  compact?: boolean;
  playerId?: string;
  active?: boolean;
  flash?: boolean;
  dataStep?: string;
}) {
  return (
    <div
      className={`gf-name-plate tone-${tone}${compact ? " is-compact" : ""}`}
      data-player-id={playerId}
      data-active={active ? "true" : undefined}
      data-flash={flash ? "true" : undefined}
      data-step={dataStep}
    >
      <span className="gf-name-dot" />
      <span className="gf-name-label">{label}</span>
      <span className="gf-name-text">{name}</span>
    </div>
  );
}
