import { describe, expect, it } from "vitest";
import {
  addDays,
  addMeal,
  createState,
  deleteStore,
  ingredientKey,
  newId,
  removeMeal,
  rollover,
  stateSchema,
  syncShopping,
  updateMeal,
  type PlannerState,
  type Recipe,
} from "../src/lib/model";

function setup() {
  const state = createState();
  const recipe: Recipe = {
    id: newId(),
    name: "玉ねぎスープ",
    servings: 4,
    rating: 5,
    notes: "家族の定番",
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
  return { state, recipe };
}
const find = (state: PlannerState, unit = "個") =>
  state.shopping.find((i) => i.source === "auto" && i.unit === unit)!;

describe("献立と買い物の整合性", () => {
  it("初期人数4人と4店舗を用意する", () => {
    const state = createState();
    expect(state.defaultServings).toBe(4);
    expect(state.stores.map((s) => s.name)).toEqual([
      "カネスエ",
      "業務スーパー",
      "100均",
      "コストコ",
    ]);
    expect(stateSchema.safeParse(state).success).toBe(true);
  });
  it("同じレシピを複数選び、同じ単位だけ合算し、人数で換算する", () => {
    let { state, recipe } = setup();
    state = addMeal(addMeal(state, recipe.id), recipe.id);
    expect(state.week.meals).toHaveLength(2);
    expect(find(state).quantity).toBe(4);
    state = updateMeal(state, state.week.meals[0].id, { servings: 2 });
    expect(find(state).quantity).toBe(3);
    expect(find(state, "g").quantity).toBe(300);
  });
  it("全角文字と空白を正規化し、別の単位とは混ぜない", () => {
    expect(ingredientKey("　卵　", "ｇ")).toBe(ingredientKey("卵", "g"));
    expect(ingredientKey("玉ねぎ", "g")).not.toBe(
      ingredientKey("玉ねぎ", "個"),
    );
  });
  it("自動更新でもチェック・購入店舗・手動追加を保持し、増量時はチェックを外す", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    const manual = {
      ...find(state),
      id: newId(),
      source: "manual" as const,
      name: "洗剤",
      quantity: 1,
    };
    state.shopping.push(manual);
    state.shopping[0] = {
      ...state.shopping[0],
      checked: true,
      storeId: state.stores[0].id,
    };
    state = syncShopping(state);
    expect(find(state).checked).toBe(true);
    state = updateMeal(state, state.week.meals[0].id, { servings: 8 });
    expect(find(state).checked).toBe(false);
    expect(find(state).storeId).toBe(state.stores[0].id);
    expect(state.shopping.find((i) => i.id === manual.id)).toEqual(manual);
    state = removeMeal(state, state.week.meals[0].id);
    expect(state.shopping).toEqual([manual]);
  });
  it("献立と履歴のレシピは後からレシピ帳を編集・削除しても変わらない", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    state.recipes[0].name = "変更後";
    state.recipes = [];
    expect(state.week.meals[0].recipe.name).toBe("玉ねぎスープ");
    state = rollover(state);
    expect(state.history[0].meals[0].recipe.name).toBe("玉ねぎスープ");
  });
});

describe("週の引き継ぎ", () => {
  it("作った料理は履歴、未調理だけ次週、未購入の手動商品は引き継ぐ", () => {
    let { state, recipe } = setup();
    state = addMeal(addMeal(state, recipe.id), recipe.id);
    state = updateMeal(state, state.week.meals[0].id, { cooked: true });
    state.shopping.push(
      {
        ...find(state),
        id: newId(),
        source: "manual",
        name: "洗剤",
        quantity: 1,
      },
      {
        ...find(state),
        id: newId(),
        source: "manual",
        name: "牛乳",
        checked: true,
        quantity: 1,
      },
    );
    const before = structuredClone(state);
    state = rollover(state);
    expect(state.history[0].meals).toEqual(before.week.meals);
    expect(state.history[0].shopping).toEqual(before.shopping);
    expect(state.week.meals).toHaveLength(1);
    expect(state.week.meals[0].carried).toBe(true);
    expect(state.week.startDate).toBe(addDays(before.week.startDate, 7));
    expect(find(state).quantity).toBe(4);
    expect(find(state).carryQuantity).toBe(2);
    expect(
      state.shopping.filter((i) => i.source === "manual").map((i) => i.name),
    ).toEqual(["洗剤"]);
    state = syncShopping(state);
    expect(find(state).quantity).toBe(4);
    state = rollover(state);
    expect(find(state).quantity).toBe(4);
    expect(state.history).toHaveLength(2);
  });
  it("未調理でも購入済みの食材は翌週に再追加せず、増員分だけ追加する", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    state.shopping = state.shopping.map((i) => ({ ...i, checked: true }));
    state = rollover(state);
    expect(state.week.meals).toHaveLength(1);
    expect(state.shopping).toHaveLength(0);
    state = syncShopping(state);
    expect(state.shopping).toHaveLength(0);
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    expect(find(state).quantity).toBe(1);
    expect(find(state, "g").quantity).toBe(100);
    state = rollover(state);
    expect(find(state).quantity).toBe(1);
    state = addMeal(state, recipe.id);
    expect(find(state).quantity).toBe(3);
  });
  it("作った料理の未購入品は献立がなくなっても翌週へ残る", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    state = updateMeal(state, state.week.meals[0].id, { cooked: true });
    state = rollover(state);
    expect(state.week.meals).toHaveLength(0);
    expect(find(state).quantity).toBe(2);
    state = rollover(state);
    expect(find(state).quantity).toBe(2);
    state.shopping = state.shopping.map((i) => ({ ...i, checked: true }));
    state = rollover(state);
    expect(state.shopping).toHaveLength(0);
  });
  it("店舗削除時は商品を残し、お店未定にする", () => {
    let { state, recipe } = setup();
    state = addMeal(state, recipe.id);
    const storeId = state.stores[0].id;
    state.shopping = state.shopping.map((i) => ({ ...i, storeId }));
    state = deleteStore(state, storeId);
    expect(state.stores).toHaveLength(3);
    expect(state.shopping).toHaveLength(2);
    expect(state.shopping.every((i) => i.storeId === null)).toBe(true);
  });
});
