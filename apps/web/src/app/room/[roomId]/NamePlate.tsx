"use client";

export function NamePlate({
  label,
  name,
  tone,
  compact = false,
}: {
  label: string;
  name: string;
  tone: "teal" | "blue";
  compact?: boolean;
}) {
  return (
    <div className={`gf-name-plate tone-${tone}${compact ? " is-compact" : ""}`}>
      <span className="gf-name-dot" />
      <span className="gf-name-label">{label}</span>
      <span className="gf-name-text">{name}</span>
    </div>
  );
}
