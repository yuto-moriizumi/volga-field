"use client";

interface BottomBarProps {
  playerName?: string;
  children?: React.ReactNode;
}

export function BottomBar({ playerName, children }: BottomBarProps) {
  return (
    <footer className="gf-bottombar">
      <div className="gf-bottombar-left">
        <span>{playerName ?? "ヴォルガ"}</span>
        {children}
      </div>
      <div className="gf-bottombar-right">
        <span className="gf-volume" aria-hidden>
          <span>♪</span>
        </span>
        <span className="gf-volume-bars" aria-hidden>
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
          <span className="on" />
        </span>
      </div>
    </footer>
  );
}
