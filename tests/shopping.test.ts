import { describe, expect, it } from "vitest";
import {
  addMeal,
  createState,
  deleteCompletedShopping,
  ingredientKey,
  newId,
  removeMeal,
  rollover,
  stateSchema,
  syncShopping,
  updateMeal,
  type PlannerState,
  type Recipe,
  type ShoppingItem,
} from "../src/lib/model";

function setup() {
  const state = createState();
  const recipe: Recipe = {
    id: newId(),
    name: "玉ねぎスープ",
    servings: 4,
    rating: 3,
    notes: "",
    ingredients: [
      {
        id: newId(),
        name: "玉ねぎ",
        quantity: 2,
        unit: "個",
        category: "野菜・果物",
      },
      {
        id: newId(),
        name: "玉ねぎ",
        quantity: 200,
        unit: "g",
        category: "野菜・果物",
      },
    ],
  };
  state.recipes.push(recipe);
  return { state: addMeal(state, recipe.id), recipe };
}
const item = (s: PlannerState, unit = "個") =>
  s.shopping.find((i) => i.source === "auto" && i.unit === unit);
function completeAndDelete(s: PlannerState, unit = "個") {
  const id = item(s, unit)!.id;
  const checked = {
    ...s,
    shopping: s.shopping.map((i) =>
      i.id === id ? { ...i, checked: true } : i,
    ),
  };
  return deleteCompletedShopping(checked, id);
}
function manual(s: PlannerState, checked: boolean): ShoppingItem {
  return {
    ...item(s)!,
    id: newId(),
    source: "manual",
    checked,
    name: "洗剤",
    quantity: 1,
    category: "日用品",
  };
}

describe("完了済み商品の削除", () => {
  it("未購入・存在しない商品の削除を拒否し、元データを変更しない", () => {
    const { state } = setup();
    const before = structuredClone(state);
    expect(() => deleteCompletedShopping(state, item(state)!.id)).toThrow(
      "完了済み",
    );
    expect(() => deleteCompletedShopping(state, newId())).toThrow("完了済み");
    expect(state).toEqual(before);
  });
  it("自動生成品を完全に取り除き、再集計・調理チェックでも復活しない", () => {
    let { state } = setup();
    const deleted = item(state)!;
    const other = item(state, "g")!;
    state = completeAndDelete(state);
    for (let n = 0; n < 3; n++) state = syncShopping(state);
    state = updateMeal(state, state.week.meals[0].id, { cooked: true });
    state = updateMeal(state, state.week.meals[0].id, { cooked: false });
    expect(state.shopping.some((i) => i.id === deleted.id)).toBe(false);
    expect(item(state)).toBeUndefined();
    expect(item(state, "g")).toEqual(other);
  });
  it("レシピ・献立ID・分量・調理状態・履歴を保ち、購入済み分だけ記録する", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    const before = structuredClone(state);
    state = completeAndDelete(state);
    expect(state.recipes).toEqual(before.recipes);
    expect(state.history).toEqual(before.history);
    expect(state.week.id).toBe(before.week.id);
    state.week.meals.forEach((meal, n) => {
      const { stocked, ...content } = meal;
      const { stocked: oldStock, ...oldContent } = before.week.meals[n];
      expect(content).toEqual(oldContent);
      expect(stocked[ingredientKey("玉ねぎ", "個")]).toBe(2);
    });
    expect(item(before)).toBeDefined(); // input was not mutated
  });
  it("手動商品の削除では同名の自動生成品と献立の在庫を変えない", () => {
    const { state } = setup();
    const extra = { ...manual(state, true), name: "玉ねぎ", unit: "個" };
    state.shopping.push(extra);
    const before = structuredClone(state);
    const next = deleteCompletedShopping(state, extra.id);
    expect(next.shopping).toEqual(
      before.shopping.filter((i) => i.id !== extra.id),
    );
    expect(next.week).toEqual(before.week);
    expect(state).toEqual(before);
  });
  it("過去からの在庫控除を保ち、今回購入した不足分を控除に加える", () => {
    let { state } = setup();
    const key = ingredientKey("玉ねぎ", "個");
    state.week.meals[0].stocked[key] = 1;
    state = syncShopping(state);
    expect(item(state)!.quantity).toBe(1);
    state = completeAndDelete(state);
    expect(state.week.meals[0].stocked[key]).toBe(2);
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    expect(item(state)!.quantity).toBe(1);
  });
});

describe("削除後の新しい需要", () => {
  it("同じレシピを新しい献立に追加すると新しい献立の分だけ表示する", () => {
    let { state, recipe } = setup();
    state = completeAndDelete(state);
    state = addMeal(state, recipe.id);
    expect(item(state)!.quantity).toBe(2);
    expect(item(state)!.checked).toBe(false);
    state = removeMeal(state, state.week.meals[1].id);
    expect(item(state)).toBeUndefined();
    state = addMeal(state, recipe.id);
    expect(item(state)!.quantity).toBe(2);
  });
  it("別レシピの同じ食材にも必要な数量を表示する", () => {
    let { state, recipe } = setup();
    state = completeAndDelete(state);
    const other = {
      ...structuredClone(recipe),
      id: newId(),
      name: "別の料理",
      ingredients: [{ ...recipe.ingredients[0], quantity: 3 }],
    };
    state.recipes.push(other);
    state = addMeal(state, other.id);
    expect(item(state)!.quantity).toBe(3);
  });
  it("人数を減らして戻しても再購入せず、購入済みを超える人数では差分だけ表示する", () => {
    let { state } = setup();
    state = completeAndDelete(state);
    const id = state.week.meals[0].id;
    state = updateMeal(state, id, { servings: 2 });
    expect(item(state)).toBeUndefined();
    state = updateMeal(state, id, { servings: 4 });
    expect(item(state)).toBeUndefined();
    state = updateMeal(state, id, { servings: 6 });
    expect(item(state)!.quantity).toBe(1);
    state = completeAndDelete(state);
    state = updateMeal(state, id, { servings: 8 });
    expect(item(state)!.quantity).toBe(1);
    expect(item(state, "g")!.quantity).toBe(400);
  });
  it("購入済みの献立を取り除いても、次に追加する別の献立の需要を抑制しない", () => {
    let { state, recipe } = setup();
    state = completeAndDelete(state);
    state = removeMeal(state, state.week.meals[0].id);
    state = addMeal(state, recipe.id);
    expect(item(state)!.quantity).toBe(2);
  });
});

describe("翌週引き継ぎ・既存保存形式", () => {
  it("完了済みから削除した食材は翌週も再購入せず、未購入の単位・手動商品だけ引き継ぐ", () => {
    let { state } = setup();
    const pending = manual(state, false);
    const completed = manual(state, true);
    state.shopping.push(pending, completed);
    state = completeAndDelete(state);
    state = rollover(state);
    expect(item(state)).toBeUndefined();
    expect(item(state, "g")!.quantity).toBe(200);
    expect(state.shopping.filter((i) => i.source === "manual")).toEqual([
      pending,
    ]);
    expect(state.week.meals).toHaveLength(1);
    state = rollover(state);
    expect(item(state)).toBeUndefined();
    expect(item(state, "g")!.quantity).toBe(200);
  });
  it("削除済み食材でも翌週の増員や新規献立による不足分は表示する", () => {
    let { state, recipe } = setup();
    state = rollover(completeAndDelete(state));
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    expect(item(state)!.quantity).toBe(1);
    state = addMeal(state, recipe.id);
    expect(item(state)!.quantity).toBe(3);
  });
  it("調理済みと未調理が混ざっても、削除した購入済み分は引き継がない", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    state = updateMeal(state, state.week.meals[0].id, { cooked: true });
    state = rollover(completeAndDelete(state));
    expect(state.week.meals).toHaveLength(1);
    expect(item(state)).toBeUndefined();
    expect(item(state, "g")!.quantity).toBe(400);
    expect(item(state, "g")!.carryQuantity).toBe(200);
  });
  it("献立がない引継ぎ品も削除でき、次週・次々週に復活しない", () => {
    let { state } = setup();
    state = updateMeal(state, state.week.meals[0].id, { cooked: true });
    state = rollover(state);
    expect(state.week.meals).toHaveLength(0);
    state = completeAndDelete(state);
    state = rollover(rollover(state));
    expect(item(state)).toBeUndefined();
    expect(item(state, "g")!.quantity).toBe(200);
  });
  it("従来のデータを読み込み、新しいフィールドなしで保存・再読込しても削除状態を保つ", () => {
    const { state } = setup();
    const legacy = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    const next = completeAndDelete(legacy);
    const reloaded = stateSchema.parse(JSON.parse(JSON.stringify(next)));
    expect(reloaded.schemaVersion).toBe(1);
    expect(Object.keys(reloaded).sort()).toEqual(Object.keys(state).sort());
    expect(item(syncShopping(reloaded))).toBeUndefined();
    expect(item(rollover(reloaded))).toBeUndefined();
    expect(reloaded.recipes).toEqual(state.recipes);
  });
});
