import type { CardDefinition } from "./cards.js";

/** 政治的防御カード（防具）を共通フォーマットで生成する。 */
export function politicalArmor(
  id: string,
  name: string,
  emoji: string,
  defense: number,
): CardDefinition {
  return {
    id,
    name,
    category: "shield",
    emoji,
    description: `防御力+${defense}`,
    price: defense,
    customTags: ["political"],
    effects: [
      {
        kind: "defense",
        amount: defense,
        target: "self",
        description: `防御力+${defense}`,
      },
    ],
  };
}

/** 防具カテゴリの政治的カード。既存の3枚と合わせて50枚になる。 */
export const POLITICAL_ARMORS: CardDefinition[] = [
  // 防御力1
  politicalArmor("namecard", "名刺", "💳", 1),
  politicalArmor("party_flyer", "政党ビラ", "📄", 1),
  politicalArmor("election_bulletin", "選挙公報", "🗞️", 1),
  politicalArmor("newspaper_ad", "新聞広告", "🖨️", 1),
  politicalArmor("sns_ad", "SNS広告", "📱", 1),
  politicalArmor("billboard", "看板", "🪧", 1),
  politicalArmor("armband", "腕章", "🎗️", 1),
  politicalArmor("supporter_postcard", "支持者ハガキ", "✉️", 1),

  // 防御力2
  politicalArmor("supporters_list", "後援会名簿", "📒", 2),
  politicalArmor("press_conference", "記者会見", "🎙️", 2),
  politicalArmor("pr_staff", "広報担当", "🗣️", 2),
  politicalArmor("party_membership", "党員証", "🪪", 2),
  politicalArmor("poster_board", "ポスター掲示板", "📌", 2),
  politicalArmor("street_van", "街宣車", "🚐", 2),
  politicalArmor("flyer_distribution", "ビラ配り", "📬", 2),
  politicalArmor("newspaper_reporter", "新聞記者", "📸", 2),

  // 防御力3
  politicalArmor("law_office", "弁護士事務所", "⚖️", 3),
  politicalArmor("political_fund", "政治資金団体", "🪙", 3),
  politicalArmor("party_hq", "政党本部", "🏦", 3),
  politicalArmor("campaign_hq", "選挙対策本部", "🗂️", 3),
  politicalArmor("opinion_poll", "世論調査", "📝", 3),
  politicalArmor("press_club", "記者クラブ", "📻", 3),
  politicalArmor("pr_office", "広報室", "💬", 3),
  politicalArmor("assembly_secretariat", "議会事務局", "🗄️", 3),

  // 防御力4
  politicalArmor("committee_room", "委員会室", "🪑", 4),
  politicalArmor("ruling_seat", "与党の議席", "🏆", 4),
  politicalArmor("opposition_questioning", "野党の追及", "❓", 4),
  politicalArmor("party_discipline", "党議拘束", "🔒", 4),
  politicalArmor("faction_unity", "派閥の結束", "🪢", 4),
  politicalArmor("ethics_committee", "政治倫理審査会", "📋", 4),

  // 防御力5
  politicalArmor("chief_cabinet_secretary", "官房長官", "💼", 5),
  politicalArmor("prime_minister_residence", "首相官邸", "🏡", 5),
  politicalArmor("parliament_building", "国会議事堂", "🏛️", 5),
  politicalArmor("constitution_article_9", "憲法第九条", "📖", 5),
  politicalArmor("us_japan_alliance", "日米同盟", "🇺🇸", 5),
  politicalArmor("un_resolution", "国連決議", "🇺🇳", 5),

  // 防御力6
  politicalArmor("defense_ministry", "防衛省", "🚁", 6),
  politicalArmor("police_agency", "警察庁", "🚓", 6),
  politicalArmor("prosecutors_office", "検察庁", "🕵️", 6),
  politicalArmor("supreme_court", "最高裁判所", "🧑‍⚖️", 6),

  // 防御力7
  politicalArmor("secrecy_law", "秘密保護法", "🔐", 7),
  politicalArmor("media_regulation", "報道規制", "📵", 7),
  politicalArmor("censorship", "検閲制度", "🚫", 7),

  // 防御力8
  politicalArmor("state_secret", "国家機密", "🗝️", 8),
  politicalArmor("state_of_emergency", "非常事態宣言", "🚨", 8),

  // 防御力9
  politicalArmor("martial_law", "戒厳令", "🪖", 9),

  // 防御力10
  politicalArmor("dictatorship", "独裁体制", "👑", 10),
];
