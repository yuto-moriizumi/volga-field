"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: {
    label: string;
    icon?: string;
    onClick: () => void;
  };
  hideTextbook?: boolean;
}

export function TopBar({
  title,
  showBack = true,
  onBack,
  rightAction,
  hideTextbook = false,
}: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const handleBack = onBack ?? (() => router.back());

  const onTextbook = pathname === "/textbook";

  return (
    <header className="gf-topbar">
      <div className="gf-topbar-left">
        {showBack && (
          <button
            className="gf-back-btn"
            onClick={handleBack}
            aria-label="戻る"
          >
            ←
          </button>
        )}
        {title && <div className="gf-topbar-title">{title}</div>}
      </div>
      <div className="gf-topbar-right">
        {rightAction && (
          <button className="gf-icon-btn" onClick={rightAction.onClick}>
            {rightAction.icon && <span>{rightAction.icon}</span>}
            <span>{rightAction.label}</span>
          </button>
        )}
        {!hideTextbook && (
          <Link
            href="/textbook"
            className={`gf-icon-btn${onTextbook ? " is-active" : ""}`}
            aria-label="教典"
          >
            <span>📖</span>
            <span>教典</span>
          </Link>
        )}
      </div>
    </header>
  );
}
