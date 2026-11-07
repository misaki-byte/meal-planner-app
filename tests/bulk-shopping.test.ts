import { describe, expect, it } from "vitest";
import {
  addMeal,
  createState,
  deleteCompletedShopping,
  deleteCompletedShoppingItems,
  ingredientKey,
  newId,
  rollover,
  stateSchema,
  syncShopping,
  updateMeal,
  type PlannerState,
  type Recipe,
  type ShoppingItem,
} from "../src/lib/model";

function setup() {
  let state = createState();
  const recipe: Recipe = {
    id: newId(),
    name: "豚肉と玉ねぎ",
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
        name: "豚肉",
        quantity: 300,
        unit: "g",
        category: "肉・魚",
      },
    ],
  };
  state.recipes.push(recipe);
  state = addMeal(state, recipe.id);
  state.shopping = state.shopping.map((i) => ({ ...i, checked: true }));
  return { state, recipe };
}
function manual(
  state: PlannerState,
  storeId: string | null,
  checked: boolean,
): ShoppingItem {
  return {
    ...state.shopping[0],
    id: newId(),
    source: "manual",
    name: "洗剤",
    quantity: 1,
    category: "日用品",
    storeId,
    checked,
  };
}

describe("完了済みの安全な一括削除", () => {
  it("対象店舗の完了済みだけを削除し、他店・お店未定・未購入品をそのまま残す", () => {
    const { state } = setup();
    const kanesue = state.stores[0].id;
    state.shopping.push(
      manual(state, kanesue, true),
      manual(state, state.stores[1].id, true),
      manual(state, null, true),
      manual(state, kanesue, false),
    );
    const ids = state.shopping
      .filter((i) => i.checked && i.storeId === kanesue)
      .map((i) => i.id);
    state.history.push({
      ...structuredClone(state.week),
      archivedAt: new Date().toISOString(),
      shopping: structuredClone(state.shopping),
    });
    const before = structuredClone(state);
    const result = deleteCompletedShoppingItems(state, ids, kanesue);
    expect(result.shopping).toEqual(
      before.shopping.filter((i) => !ids.includes(i.id)),
    );
    expect(result.recipes).toEqual(before.recipes);
    expect(result.history).toEqual(before.history);
    expect(result.week.meals.map(({ stocked, ...meal }) => meal)).toEqual(
      before.week.meals.map(({ stocked, ...meal }) => meal),
    );
    expect(state).toEqual(before);
  });
  it("すべての店舗の完了済みをまとめて削除しても未購入品は保護する", () => {
    const { state } = setup();
    state.shopping[1].checked = false;
    state.shopping.push(
      manual(state, state.stores[1].id, true),
      manual(state, null, true),
      manual(state, state.stores[2].id, false),
    );
    const pending = structuredClone(state.shopping.filter((i) => !i.checked));
    const ids = state.shopping.filter((i) => i.checked).map((i) => i.id);
    const result = deleteCompletedShoppingItems(state, ids);
    expect(result.shopping).toEqual(pending);
  });
  it("お店未定を対象にしても、他店の完了済みを削除しない", () => {
    const { state } = setup();
    const extra = manual(state, null, true);
    state.shopping.push(extra);
    const result = deleteCompletedShoppingItems(state, [extra.id], null);
    expect(result.shopping).toEqual(
      state.shopping.filter((i) => i.id !== extra.id),
    );
    expect(result.week).toEqual(state.week);
  });
  it("未購入品のIDが一つでも混ざった場合は全件の削除を中止する", () => {
    const { state } = setup();
    state.shopping[1].checked = false;
    const before = structuredClone(state);
    expect(() =>
      deleteCompletedShoppingItems(
        state,
        state.shopping.map((i) => i.id),
      ),
    ).toThrow("完了済み");
    expect(state).toEqual(before);
  });
  it("確認後にチェック解除・店舗変更・個別削除された場合も一部だけ削除しない", () => {
    const { state } = setup();
    const ids = state.shopping.map((i) => i.id);
    for (const changed of [
      {
        ...state,
        shopping: state.shopping.map((i, n) =>
          n === 0 ? { ...i, checked: false } : i,
        ),
      },
      {
        ...state,
        shopping: state.shopping.map((i, n) =>
          n === 0 ? { ...i, storeId: state.stores[1].id } : i,
        ),
      },
      { ...state, shopping: state.shopping.slice(1) },
    ]) {
      const before = structuredClone(changed);
      expect(() =>
        deleteCompletedShoppingItems(changed, ids, state.stores[0].id),
      ).toThrow("確認");
      expect(changed).toEqual(before);
    }
  });
  it("確認後に増えた完了済み商品は削除対象に含めない", () => {
    const { state } = setup();
    const ids = state.shopping.map((i) => i.id);
    const added = manual(state, state.stores[0].id, true);
    state.shopping.push(added);
    expect(deleteCompletedShoppingItems(state, ids).shopping).toEqual([added]);
  });
  it("個別削除と同じ在庫控除になり、ID重複でも購入量を二重計上しない", () => {
    const { state } = setup();
    const ids = state.shopping.map((i) => i.id);
    const individually = ids.reduce(
      (s, id) => deleteCompletedShopping(s, id),
      state,
    );
    expect(deleteCompletedShoppingItems(state, [...ids, ...ids])).toEqual(
      individually,
    );
    expect(deleteCompletedShoppingItems(state, []).shopping).toEqual(
      state.shopping,
    );
  });
  it("献立に対応しない古い未購入の自動行も、削除の副作用で消さない", () => {
    const { state } = setup();
    const orphan = {
      ...state.shopping[0],
      id: newId(),
      name: "旧データの材料",
      checked: false,
    };
    state.shopping.push(orphan);
    expect(
      deleteCompletedShoppingItems(state, [state.shopping[0].id]).shopping,
    ).toContainEqual(orphan);
  });
  it("自動生成品をまとめて消しても再計算で復活せず、増員・新規献立の不足分は出る", () => {
    let { state, recipe } = setup();
    state = deleteCompletedShoppingItems(
      state,
      state.shopping.map((i) => i.id),
    );
    state = syncShopping(syncShopping(state));
    expect(state.shopping).toEqual([]);
    expect(state.week.meals[0].stocked[ingredientKey("玉ねぎ", "個")]).toBe(2);
    expect(state.week.meals[0].stocked[ingredientKey("豚肉", "g")]).toBe(300);
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    expect(state.shopping.map((i) => i.quantity)).toEqual([1, 150]);
    state = addMeal(state, recipe.id);
    expect(state.shopping.map((i) => i.quantity)).toEqual([3, 450]);
    expect(state.shopping.every((i) => !i.checked)).toBe(true);
  });
  it("保存・再読込と複数回の翌週引き継ぎでも、購入済み材料を再購入しない", () => {
    let { state } = setup();
    const pending = manual(state, state.stores[0].id, false);
    state.shopping.push(pending);
    state = deleteCompletedShoppingItems(
      state,
      state.shopping.filter((i) => i.checked).map((i) => i.id),
    );
    state = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    state = rollover(rollover(state));
    expect(state.shopping).toEqual([pending]);
    expect(state.week.meals).toHaveLength(1);
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    expect(
      state.shopping.filter((i) => i.source === "auto").map((i) => i.quantity),
    ).toEqual([1, 150]);
  });
  it("購入済みの手動行だけを消しても、同名食材の献立在庫は増やさない", () => {
    const { state } = setup();
    state.shopping = state.shopping.map((i) => ({ ...i, checked: false }));
    const extra = {
      ...manual(state, state.stores[0].id, true),
      name: "玉ねぎ",
      unit: "個",
    };
    state.shopping.push(extra);
    const result = deleteCompletedShoppingItems(state, [extra.id]);
    expect(result.week).toEqual(state.week);
    expect(result.shopping).toEqual(
      state.shopping.filter((i) => i.id !== extra.id),
    );
  });
});
