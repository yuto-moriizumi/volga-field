import { canDefendAttribute } from "@volga/game-core";
import type { CardAttribute } from "@volga/shared";

/**
 * 属性の表示（日本語ラベルと色）はここだけで決める。
 * 表示専用の定義で、ゲームのルールは packages/game-core が持つ。
 * CSS 側は `data-attribute` を見て色を当てる（attribute.css）。
 */

export interface AttributeTone {
  /** 画面に出す日本語ラベル */
  label: string;
}

export const ATTRIBUTE_TONES: Record<CardAttribute, AttributeTone> = {
  none: { label: "無属性" },
  socialism: { label: "社会主義" },
  capitalism: { label: "資本主義" },
  republicanism: { label: "共和主義" },
  feudalism: { label: "封建主義" },
  environmentalism: { label: "環境主義" },
  anarchism: { label: "無政府主義" },
};

/** 教典や一覧で並べる順番。 */
export const ATTRIBUTE_ORDER: readonly CardAttribute[] = [
  "none",
  "socialism",
  "capitalism",
  "republicanism",
  "feudalism",
  "environmentalism",
  "anarchism",
];

export function attributeLabel(attribute: CardAttribute | undefined | null): string {
  return ATTRIBUTE_TONES[attribute ?? "none"].label;
}

/** その攻撃属性を防げる防御属性の一覧（game-core の判定をそのまま使う）。 */
export function defendingAttributes(
  attack: CardAttribute | undefined | null,
): CardAttribute[] {
  const attackAttribute = attack ?? "none";
  return ATTRIBUTE_ORDER.filter((defense) =>
    canDefendAttribute(defense, attackAttribute),
  );
}

/**
 * 防御のときに出す案内文。防げる属性名を必ず文字で示す。
 * （バッジと並べるときは attackDefenseRule だけを使う）
 */
export function attackDefenseRule(
  attack: CardAttribute | undefined | null,
): string {
  const attackAttribute = attack ?? "none";
  if (attackAttribute === "environmentalism") {
    return "属性により防御不可（どの盾でも防げない）";
  }
  if (attackAttribute === "anarchism") {
    return "盾で防げるが、ダメージが通るとHPは0になる";
  }
  if (attackAttribute === "none") {
    return "どの盾でも防御できる";
  }
  const shields = defendingAttributes(attackAttribute).map(attributeLabel);
  return `${shields.join("・")}の盾のみ防御できる`;
}

/** 教典の属性グループに添える一行説明。 */
export function attributeGroupNote(attribute: CardAttribute): string {
  if (attribute === "environmentalism") {
    return "この属性の攻撃は盾では防げない";
  }
  if (attribute === "anarchism") {
    return "盾で防げるが、ダメージが通るとHPは0になる";
  }
  if (attribute === "none") {
    return "どの盾でも防御できる";
  }
  const shields = defendingAttributes(attribute).map(attributeLabel);
  return `${shields.join("・")}の盾で防御できる`;
}

/**
 * 属性バッジ。色だけでなく必ず日本語ラベルを表示する。
 */
export function AttributeBadge({
  attribute,
}: {
  attribute: CardAttribute | undefined | null;
}) {
  const key = attribute ?? "none";
  const tone = ATTRIBUTE_TONES[key];
  return (
    <span
      className="gf-attr-badge"
      data-attribute={key}
      title={`属性: ${tone.label}`}
    >
      <span className="gf-attr-badge-dot" aria-hidden="true" />
      {tone.label}
    </span>
  );
}
