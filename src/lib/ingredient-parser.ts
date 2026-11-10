import type { Category, Ingredient } from "./model";

export type ParsedIngredient = {
  line: number;
  source: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: Category;
  issues: string[];
};
export type IngredientParseResult = {
  ingredients: ParsedIngredient[];
  servings: { value: number; source: string }[];
  headings: string[];
};

// Local rules only: no requests, storage, AI, or changes to the persisted model.
const categoryRules: [Category, RegExp][] = [
  [
    "豆腐・加工品",
    /豆腐|とうふ|厚揚げ|油揚げ|納豆|ちくわ|竹輪|かまぼこ|わかめ|ひじき|こんにゃく|ツナ|ハム|ベーコン|ソーセージ|豆乳/,
  ],
  [
    "調味料",
    /しょうゆ|醤油|みりん|味噌|みそ|砂糖|塩|こしょう|胡椒|酢|油|だし|出汁|コンソメ|ソース|ケチャップ|マヨネーズ|ごま|胡麻|片栗粉|小麦粉|カレールー|鶏がら|鶏ガラ/,
  ],
  ["卵・乳製品", /卵|たまご|玉子|牛乳|バター|チーズ|ヨーグルト|生クリーム/],
  [
    "肉・魚",
    /豚|鶏|牛|ひき肉|挽き肉|合いびき|鮭|さけ|サーモン|さば|鯖|鯵|あじ|いわし|鰯|まぐろ|たら|鱈|えび|海老|いか|イカ|たこ|タコ|あさり|しじみ|魚|肉/,
  ],
  [
    "米・麺・パン",
    /米|ご飯|ごはん|麺|うどん|そば|パスタ|スパゲ[ッテ]ィ|パン|そうめん/,
  ],
  [
    "野菜・果物",
    /玉ねぎ|玉葱|たまねぎ|ねぎ|葱|にんじん|人参|じゃがいも|ジャガイモ|キャベツ|白菜|はくさい|ほうれん草|小松菜|大根|だいこん|きゅうり|トマト|ピーマン|なす|茄子|ブロッコリー|もやし|しめじ|えのき|しいたけ|きのこ|にんにく|生姜|しょうが|レタス|かぼちゃ|れんこん|ごぼう|レモン|りんご|バナナ/,
  ],
];

export function inferIngredientCategory(name: string): Category {
  return (
    categoryRules.find(([, pattern]) => pattern.test(name))?.[0] ?? "その他"
  );
}

function normalize(text: string) {
  return text
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .normalize("NFKC")
    .replace(/[⁄∕]/g, "/")
    .replace(/\r\n?/g, "\n");
}

const numeric = String.raw`(?:\d+\s*(?:と|\s)\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?|半)`;
const units =
  "大さじ|小さじ|カップ|パック|切れ|つまみ|ひとつまみ|ひとつかみ|皿分|かけ|片|kg|mg|ml|cc|g|l|個|本|枚|束|丁|袋|缶|合|杯|尾|匹|玉|房|粒|株|膳";
const amountLast = new RegExp(
  `^(.+?)\\s*(約)?\\s*(${numeric})\\s*(${units})(半)?$`,
  "i",
);
const spoonFirst = new RegExp(
  `^(.+?)\\s*(大さじ|小さじ|カップ)\\s*[:：]?\\s*(約)?\\s*(${numeric})(半)?$`,
);
const vagueLast =
  /^(.+?)\s*(各)?\s*(少々|適量|ひとつまみ|ひとつかみ|お好みで)$/;
// Some recipe sites copy their name and amount columns onto separate lines.
// Join only an immediately following, complete amount; never guess across headings.
const amountOnly = new RegExp(
  `^(?:(?:約\\s*)?${numeric}\\s*(?:${units})(?:半)?|(?:大さじ|小さじ|カップ)\\s*[:：]?\\s*(?:約\\s*)?${numeric}(?:半)?|少々|適量|ひとつまみ|ひとつかみ|お好みで)$`,
  "i",
);

function numberValue(text: string): number | null {
  if (text === "半") return 0.5;
  const mixed = text.match(/^(\d+)\s*(?:と|\s)\s*(\d+)\s*\/\s*(\d+)$/);
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  const value = mixed
    ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    : fraction
      ? Number(fraction[1]) / Number(fraction[2])
      : Number(text);
  return Number.isFinite(value) && value >= 0.0001 && value <= 1_000_000
    ? value
    : null;
}

function cleanPrefix(line: string) {
  return line
    .replace(/^[\s・●○◯◎■□◆◇★☆※*\-–—•▶]+/, "")
    .replace(/^(?:【材料】|\[材料\])\s*[:：]?\s*/, "")
    .replace(/^(?:\(?[A-Z]\)|\[[A-Z]\]|【[A-Z]】)\s*/, "")
    .replace(/^[A-Z](?:[.:：・]\s*|\s+|(?=[ぁ-んァ-ヶ一-龠]))/, "")
    .trim();
}

export function parseIngredients(text: string): IngredientParseResult {
  const result: IngredientParseResult = {
    ingredients: [],
    servings: [],
    headings: [],
  };
  const sources = text.replace(/\r\n?/g, "\n").split("\n");
  const lines = normalize(text).split("\n");
  let consumedLine = -1;
  lines.forEach((raw, index) => {
    if (index === consumedLine) return;
    let source = sources[index]?.trim() ?? raw.trim();
    let line = cleanPrefix(raw);
    if (!line) {
      if (source) result.headings.push(source);
      return;
    }
    // Only remove a line when its entire content is a recognized heading/serving label.
    const addServings = (values: number[]) => {
      if (values.every((n) => n >= 1 && n <= 100)) {
        for (const value of values) {
          if (!result.servings.some((s) => s.value === value)) {
            result.servings.push({ value, source });
          }
        }
      }
    };
    // Also offer counts inside prose, while retaining the complete line for review.
    for (const match of line.matchAll(
      /(?:^|[^\d])(\d{1,3})\s*(?:[〜~～\-–]\s*(\d{1,3})\s*)?人(?:分|前)/g,
    )) {
      addServings(match.slice(1).filter(Boolean).map(Number));
    }
    const label = line.replace(/[【】\[\]()<>〈〉《》:：*#]/g, " ").trim();
    const servingLabel = label.replace(/^(?:材料|分量|食材)\s*/, "");
    const serving = servingLabel.match(
      /^(\d+)\s*(?:[〜~～\-–]\s*(\d+)\s*)?人(?:分|前)?$/,
    );
    if (serving) {
      const values = [...new Set(serving.slice(1).filter(Boolean).map(Number))];
      if (values.every((n) => n >= 1 && n <= 100)) {
        addServings(values);
        result.headings.push(source);
        return;
      }
    }
    if (
      /^(?:材料|分量|食材|調味料|合わせ調味料|下味|たれ|タレ|トッピング|仕上げ|作り方|手順|[A-Z])$/.test(
        label,
      )
    ) {
      result.headings.push(source);
      return;
    }

    const next = lines[index + 1]?.trim() ?? "";
    if (
      !/[\d]|半$|(?:少々|適量|ひとつまみ|ひとつかみ|お好みで)$/.test(line) &&
      !/^[【\[(].*[】\])]$/.test(line) &&
      amountOnly.test(next)
    ) {
      line = `${line} ${next}`;
      source += `\n${sources[index + 1].trim()}`;
      consumedLine = index + 1;
    }

    const issues: string[] = [];
    // Keep preparation notes as part of the name; a trailing amount note needs review.
    const amountNote = line.match(/\s*\([^)]*\d[^)]*\)\s*$/);
    if (amountNote) {
      const without = line.slice(0, amountNote.index).trim();
      if (amountLast.test(without) || spoonFirst.test(without)) {
        line = without;
        issues.push("括弧内の補足分量を原文で確認してください。");
      }
    }
    let name = line;
    let quantity: number | null = null;
    let unit = "";
    const last = line.match(amountLast);
    const first = line.match(spoonFirst);
    const vague = line.match(vagueLast);
    if (first || last) {
      const m = (first ?? last)!;
      name = m[1];
      unit = first ? m[2] : m[4];
      quantity = numberValue(first ? m[4] : m[3]);
      if (m[5] && quantity !== null) quantity += 0.5;
      if (first ? m[3] : m[2])
        issues.push("「約」の付いた分量です。確認してください。");
    } else if (vague) {
      name = vague[1];
      quantity = 1;
      unit = vague[3];
      if (vague[2])
        issues.push(
          "複数の食材に「各」が付いています。必要なら個別入力してください。",
        );
    } else {
      issues.push("分量・単位を判定できません。原文を残しています。");
    }
    name = name.replace(/[\s:：・.…‥]+$/, "").trim();
    unit = unit.toLowerCase().replace(/^cc$/, "ml");
    // Do not interpret ranges, alternatives, or several ingredients as a single amount.
    if (/[\d/〜~～]|(?:各|または|又は)|[、,]|[-−+]\s*$/.test(name)) {
      issues.push(
        "範囲・複数の材料などが含まれています。食材と分量を確認してください。",
      );
      quantity = null;
    }
    if (quantity === null && (first || last))
      issues.push("分量は0より大きく、100万以下で入力してください。");
    if (!name || name.length > 100)
      issues.push("食材名を1〜100文字に修正してください。");
    const category = inferIngredientCategory(name);
    if (category === "その他")
      issues.push("カテゴリを判定できません。確認してください。");
    result.ingredients.push({
      line: index + 1,
      source,
      name,
      quantity,
      unit,
      category,
      issues,
    });
  });
  return result;
}

/** Append only. Never merge duplicate names, change IDs, or mutate existing rows. */
export function appendImportedIngredients(
  existing: Ingredient[],
  additions: Ingredient[],
): Ingredient[] {
  if (existing.length + additions.length > 100)
    throw new Error("食材は合計100行までです。追加する行を減らしてください。");
  return [...existing, ...additions];
}
