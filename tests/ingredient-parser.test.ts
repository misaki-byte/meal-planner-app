import { describe, expect, it } from "vitest";
import {
  appendImportedIngredients,
  inferIngredientCategory,
  parseIngredients,
} from "../src/lib/ingredient-parser";
import {
  createState,
  ingredientSchema,
  newId,
  stateSchema,
  type Ingredient,
} from "../src/lib/model";

describe("日本語の材料貼り付け", () => {
  it.each([
    ["玉ねぎ 1/2個", "玉ねぎ", 0.5, "個", "野菜・果物"],
    ["豚肉 300g", "豚肉", 300, "g", "肉・魚"],
    ["しょうゆ 大さじ2", "しょうゆ", 2, "大さじ", "調味料"],
    ["塩 少々", "塩", 1, "少々", "調味料"],
    ["油 適量", "油", 1, "適量", "調味料"],
    ["砂糖 小さじ1/2", "砂糖", 0.5, "小さじ", "調味料"],
    ["みりん 大さじ1と1/2", "みりん", 1.5, "大さじ", "調味料"],
    ["しょうゆ 大さじ1 1/2", "しょうゆ", 1.5, "大さじ", "調味料"],
    ["牛乳 １．５カップ", "牛乳", 1.5, "カップ", "卵・乳製品"],
    ["豆腐 １／２丁", "豆腐", 0.5, "丁", "豆腐・加工品"],
    ["玉ねぎ 半個", "玉ねぎ", 0.5, "個", "野菜・果物"],
    ["玉ねぎ 1個半", "玉ねぎ", 1.5, "個", "野菜・果物"],
    ["砂糖 大さじ1半", "砂糖", 1.5, "大さじ", "調味料"],
    ["牛乳 １００ＭＬ", "牛乳", 100, "ml", "卵・乳製品"],
    ["牛乳 100cc", "牛乳", 100, "ml", "卵・乳製品"],
    ["米 2合", "米", 2, "合", "米・麺・パン"],
    ["油揚げ 1枚", "油揚げ", 1, "枚", "豆腐・加工品"],
    ["鶏がらスープの素 小さじ1", "鶏がらスープの素", 1, "小さじ", "調味料"],
    [
      "玉ねぎ（みじん切り）…1/2個",
      "玉ねぎ(みじん切り)",
      0.5,
      "個",
      "野菜・果物",
    ],
    ["しょうゆ：大さじ２", "しょうゆ", 2, "大さじ", "調味料"],
    ["玉ねぎ ½個", "玉ねぎ", 0.5, "個", "野菜・果物"],
    ["牛乳 1½カップ", "牛乳", 1.5, "カップ", "卵・乳製品"],
    ["しょうゆ 大さじ：２", "しょうゆ", 2, "大さじ", "調味料"],
    ["砂糖 小さじ:1/2", "砂糖", 0.5, "小さじ", "調味料"],
    ["玉ねぎ・・・1/2個", "玉ねぎ", 0.5, "個", "野菜・果物"],
  ])(
    "%sを食材・分量・単位・カテゴリに変換する",
    (source, name, quantity, unit, category) => {
      const { ingredients } = parseIngredients(source);
      expect(ingredients).toHaveLength(1);
      expect(ingredients[0]).toMatchObject({
        source,
        name,
        quantity,
        unit,
        category,
        issues: [],
      });
    },
  );

  it("見出し・グループ記号・箇条書き・改行コードが混ざっても材料を取り出す", () => {
    const result = parseIngredients(
      "【材料（２人分）】\r\n・玉ねぎ 1/2個\r\n●豚肉 300g\r\nA\r\nA しょうゆ 大さじ2\r\n【B】砂糖 小さじ1\r\nA・みりん 大さじ1\r\n【材料】塩 少々\r\n",
    );
    expect(result.ingredients.map((r) => r.name)).toEqual([
      "玉ねぎ",
      "豚肉",
      "しょうゆ",
      "砂糖",
      "みりん",
      "塩",
    ]);
    expect(result.ingredients.every((r) => r.issues.length === 0)).toBe(true);
    expect(result.servings).toEqual([
      { value: 2, source: "【材料（２人分）】" },
    ]);
    expect(result.headings).toContain("A");
  });

  it.each(["2人分", "材料 2人前", "【材料】（2人分）", "材料（2人分）"])(
    "%sから人数候補を返す",
    (source) => {
      expect(parseIngredients(source).servings.map((s) => s.value)).toEqual([
        2,
      ]);
    },
  );
  it("食材名と分量が別行のコピーでも元の行番号と原文を保つ", () => {
    const result = parseIngredients(
      "【材料（２人分）】\r\n・玉ねぎ\r\n１／２個\r\n豚肉 300g\r\nA しょうゆ\r\n大さじ：２\r\n塩\r\n少々\r\n牛乳\r\n１００ＭＬ",
    );
    expect(
      result.ingredients.map((r) => [r.name, r.quantity, r.unit, r.line]),
    ).toEqual([
      ["玉ねぎ", 0.5, "個", 2],
      ["豚肉", 300, "g", 4],
      ["しょうゆ", 2, "大さじ", 5],
      ["塩", 1, "少々", 7],
      ["牛乳", 100, "ml", 9],
    ]);
    expect(result.ingredients[0].source).toBe("・玉ねぎ\n１／２個");
    expect(result.ingredients[2].source).toBe("A しょうゆ\n大さじ：２");
    expect(result.ingredients.every((r) => r.issues.length === 0)).toBe(true);
    expect(result.servings.map((s) => s.value)).toEqual([2]);
  });
  it("別行の解釈で見出し・空行・不明な行・別の材料を飛ばして結合しない", () => {
    const result = parseIngredients(
      "【不明な見出し】\n大さじ2\n玉ねぎ\n\n1/2個\nにんじん\n豚肉 300g\n塩\n-2g\n砂糖\n小さじ1/0",
    );
    expect(result.ingredients.map((r) => r.source)).toEqual([
      "【不明な見出し】",
      "大さじ2",
      "玉ねぎ",
      "1/2個",
      "にんじん",
      "豚肉 300g",
      "塩",
      "-2g",
      "砂糖\n小さじ1/0",
    ]);
    expect(result.ingredients.at(-1)?.quantity).toBeNull();
    expect(result.ingredients.at(-1)?.issues.length).toBeGreaterThan(0);
  });
  it("人数の範囲・重複・複数候補を勝手に選ばない", () => {
    const result = parseIngredients(
      "材料（2〜3人分）\n2人分\n4人前\n豚肉 300g",
    );
    expect(result.servings.map((s) => s.value)).toEqual([2, 3, 4]);
    expect(result.ingredients).toHaveLength(1);
  });
  it("説明文の人数も候補にし、説明文や材料行自体は消さない", () => {
    const result = parseIngredients(
      "こちらは2人分の材料です\n豚肉（2人前） 300g\n**材料（4人分）**",
    );
    expect(result.servings.map((s) => s.value)).toEqual([2, 4]);
    expect(result.ingredients.map((r) => r.source)).toEqual([
      "こちらは2人分の材料です",
      "豚肉（2人前） 300g",
    ]);
    expect(result.headings).toEqual(["**材料（4人分）**"]);
  });
  it("判定できない行を原文付きで残す", () => {
    const lines = [
      "秘密の材料",
      "【謎の見出し】",
      "塩 お好みの量",
      "101人分",
      "玉ねぎ 1〜2個",
      "豚肉 -300g",
      "砂糖 大さじ1/0",
      "塩 0g",
      "玉ねぎ1個、にんじん1本",
    ];
    const rows = parseIngredients(lines.join("\n")).ingredients;
    expect(rows.map((r) => r.source)).toEqual(lines);
    expect(rows.every((r) => r.issues.length > 0)).toBe(true);
    expect(rows.every((r) => r.quantity === null)).toBe(true);
  });
  it("注記や各分量は要確認にする", () => {
    for (const source of [
      "鶏もも肉 1枚（約300g）",
      "豚肉 約300g",
      "塩・こしょう 各少々",
    ]) {
      const row = parseIngredients(source).ingredients[0];
      expect(row.source).toBe(source);
      expect(row.issues.length).toBeGreaterThan(0);
    }
  });
  it("未知のカテゴリはその他で残す", () => {
    const row = parseIngredients("ドラゴンフルーツ 1個").ingredients[0];
    expect(row).toMatchObject({
      name: "ドラゴンフルーツ",
      quantity: 1,
      unit: "個",
      category: "その他",
    });
    expect(row.issues.length).toBeGreaterThan(0);
    expect(inferIngredientCategory("ABCソース")).toBe("調味料");
    expect(parseIngredients("ABCソース 1g").ingredients[0].name).toBe(
      "ABCソース",
    );
  });
  it("重複する材料も勝手に合算・削除しない", () => {
    expect(
      parseIngredients("しょうゆ 大さじ1\nしょうゆ 大さじ2").ingredients.map(
        (r) => r.quantity,
      ),
    ).toEqual([1, 2]);
  });
  it("空行だけなら材料は0行、上限を超えた入力も切り捨てない", () => {
    expect(parseIngredients("\n \n").ingredients).toEqual([]);
    expect(
      parseIngredients(Array(101).fill("玉ねぎ 1個").join("\n")).ingredients,
    ).toHaveLength(101);
  });
});

describe("既存データの保護と保存形式の互換性", () => {
  const ingredient = (): Ingredient => ({
    id: newId(),
    name: "玉ねぎ",
    quantity: 2,
    unit: "個",
    category: "野菜・果物",
  });
  it("既存行・ID・並び順・重複をそのまま残して末尾に追加する", () => {
    const existing = [ingredient()];
    const before = structuredClone(existing);
    const additions = [ingredient()];
    const result = appendImportedIngredients(existing, additions);
    expect(result).toEqual([...before, ...additions]);
    expect(existing).toEqual(before);
    expect(result).not.toBe(existing);
  });
  it("100行上限を超えても既存行を消さない", () => {
    const existing = Array.from({ length: 100 }, ingredient);
    const before = structuredClone(existing);
    expect(() => appendImportedIngredients(existing, [ingredient()])).toThrow(
      "100行",
    );
    expect(existing).toEqual(before);
    expect(
      appendImportedIngredients(existing.slice(1), [ingredient()]),
    ).toHaveLength(100);
  });
  it("解析の一時情報を保存データに含めず、既存のスキーマで保存できる", () => {
    const state = createState();
    const ingredients = parseIngredients(
      "玉ねぎ 1/2個\n豚肉 300g\nしょうゆ 大さじ2\n塩 少々",
    ).ingredients.map((r) => ingredientSchema.parse({ ...r, id: newId() }));
    state.recipes.push({
      id: newId(),
      name: "貼り付けテスト",
      servings: 2,
      rating: 3,
      notes: "",
      ingredients,
    });
    expect(stateSchema.safeParse(state).success).toBe(true);
    expect(Object.keys(ingredients[0]).sort()).toEqual(
      ["id", "name", "quantity", "unit", "category"].sort(),
    );
  });
});
