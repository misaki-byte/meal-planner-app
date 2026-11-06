import { describe, expect, it } from "vitest";
import {
  addMeal,
  createState,
  deleteCompletedShopping,
  deleteStore,
  getDefaultStoreId,
  newId,
  rollover,
  stateSchema,
  syncShopping,
  updateMeal,
  type Recipe,
} from "../src/lib/model";

function setup() {
  let state = createState();
  const recipe: Recipe = {
    id: newId(),
    name: "野菜スープ",
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
        name: "にんじん",
        quantity: 1,
        unit: "本",
        category: "野菜・果物",
      },
    ],
  };
  const other: Recipe = {
    ...structuredClone(recipe),
    id: newId(),
    name: "卵スープ",
    ingredients: [
      recipe.ingredients[0],
      {
        id: newId(),
        name: "卵",
        quantity: 2,
        unit: "個",
        category: "卵・乳製品",
      },
    ],
  };
  state.recipes.push(recipe, other);
  state = addMeal(state, recipe.id);
  return { state, recipe, other };
}

describe("買い物の初期店舗", () => {
  it("初期設定は登録済みカネスエのIDで、すべての新規自動生成品に適用する", () => {
    const { state } = setup();
    const kanesue = state.stores.find((s) => s.name === "カネスエ")!.id;
    expect(state.defaultStoreId).toBe(kanesue);
    expect(getDefaultStoreId(state)).toBe(kanesue);
    expect(state.shopping).toHaveLength(2);
    expect(state.shopping.every((i) => i.storeId === kanesue)).toBe(true);
  });
  it("設定のない旧データでもカネスエを使い、既存の他店・未設定を変更しない", () => {
    const { state, other } = setup();
    state.shopping[0].storeId = state.stores[1].id;
    state.shopping[1].storeId = null;
    state.shopping[1].checked = true;
    const { defaultStoreId, ...legacy } = state;
    const loaded = stateSchema.parse(JSON.parse(JSON.stringify(legacy)));
    expect(loaded.defaultStoreId).toBeUndefined();
    expect(getDefaultStoreId(loaded)).toBe(state.stores[0].id);
    expect(syncShopping(loaded).shopping).toEqual(legacy.shopping);
    const next = addMeal(loaded, other.id);
    expect(next.shopping.find((i) => i.name === "玉ねぎ")!.storeId).toBe(
      state.stores[1].id,
    );
    expect(
      next.shopping.find((i) => i.name === "にんじん")!.storeId,
    ).toBeNull();
    expect(next.shopping.find((i) => i.name === "卵")!.storeId).toBe(
      state.stores[0].id,
    );
    expect(legacy.shopping).toEqual(loaded.shopping);
  });
  it("再計算・人数変更・同じ材料の追加で変更先とお店未定を保持する", () => {
    let { state, other } = setup();
    state.shopping[0].storeId = state.stores[1].id;
    state.shopping[1].storeId = null;
    const ids = state.shopping.map((i) => i.id);
    state.defaultStoreId = state.stores[3].id;
    state = syncShopping(syncShopping(state));
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    state = addMeal(state, other.id);
    expect(state.shopping.find((i) => i.id === ids[0])!.storeId).toBe(
      state.stores[1].id,
    );
    expect(state.shopping.find((i) => i.id === ids[1])!.storeId).toBeNull();
    expect(state.shopping.find((i) => i.name === "卵")!.storeId).toBe(
      state.stores[3].id,
    );
    expect(state.shopping.find((i) => i.name === "玉ねぎ")!.quantity).toBe(5);
  });
  it("設定を変えても既存の買うもの・完了済み・手動商品を振り替えない", () => {
    let { state } = setup();
    state.shopping[1].checked = true;
    state.shopping.push({
      ...state.shopping[0],
      id: newId(),
      source: "manual",
      name: "洗剤",
      storeId: state.stores[2].id,
    });
    const before = structuredClone(state);
    state = syncShopping({ ...state, defaultStoreId: state.stores[3].id });
    expect(state.shopping).toEqual(before.shopping);
    expect(state.recipes).toEqual(before.recipes);
    expect(state.week).toEqual(before.week);
    expect(state.history).toEqual(before.history);
  });
  it("名前が変わっても明示設定した初期店舗はIDで維持する", () => {
    let { state, other } = setup();
    state = {
      ...state,
      stores: state.stores.map((s) =>
        s.id === state.defaultStoreId ? { ...s, name: "いつものスーパー" } : s,
      ),
    };
    expect(getDefaultStoreId(state)).toBe(state.defaultStoreId);
    state = addMeal(state, other.id);
    expect(state.shopping.find((i) => i.name === "卵")!.storeId).toBe(
      state.defaultStoreId,
    );
  });
  it("初期店舗を削除しても商品や献立を残し、新規商品もお店未定にする", () => {
    let { state, other } = setup();
    const before = structuredClone(state);
    state = deleteStore(state, state.defaultStoreId!);
    expect(state.defaultStoreId).toBeNull();
    expect(getDefaultStoreId(state)).toBeNull();
    expect(state.shopping.map((i) => i.id)).toEqual(
      before.shopping.map((i) => i.id),
    );
    expect(state.recipes).toEqual(before.recipes);
    expect(state.week).toEqual(before.week);
    state = addMeal(state, other.id);
    expect(state.shopping.every((i) => i.storeId === null)).toBe(true);
  });
  it("旧データの初期店舗を削除した後、同名店舗を再登録しても勝手に初期店舗にしない", () => {
    const { state } = setup();
    const { defaultStoreId, ...legacy } = state;
    const next = deleteStore(legacy, state.stores[0].id);
    next.stores.push({ id: newId(), name: "カネスエ" });
    expect(next.defaultStoreId).toBeNull();
    expect(getDefaultStoreId(next)).toBeNull();
  });
  it("他店の削除では初期店舗の選択を保持する", () => {
    const { state } = setup();
    const next = deleteStore(state, state.stores[1].id);
    expect(getDefaultStoreId(next)).toBe(state.defaultStoreId);
  });
  it("旧データにカネスエがない場合、店舗を勝手に作成しない", () => {
    const { state, other } = setup();
    const { defaultStoreId, ...legacy } = state;
    legacy.stores = legacy.stores.slice(1);
    const next = addMeal(stateSchema.parse(legacy), other.id);
    expect(next.stores).toEqual(legacy.stores);
    expect(getDefaultStoreId(next)).toBeNull();
    expect(next.shopping.find((i) => i.name === "卵")!.storeId).toBeNull();
  });
  it.each([null, "11111111-1111-4111-8111-111111111111"])(
    "明示的な未設定・存在しないID (%s) をカネスエで上書きしない",
    (storeId) => {
      let { state, other } = setup();
      state.defaultStoreId = storeId;
      state = addMeal(state, other.id);
      expect(getDefaultStoreId(state)).toBeNull();
      expect(state.shopping.find((i) => i.name === "卵")!.storeId).toBeNull();
    },
  );
  it("初期店舗と個別店舗は保存・再読込・翌週引き継ぎでも保持する", () => {
    let { state, other } = setup();
    state.defaultStoreId = state.stores[3].id;
    state.shopping[0].storeId = state.stores[1].id;
    state.shopping[1].storeId = null;
    state = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    state = rollover(state);
    expect(state.defaultStoreId).toBe(state.stores[3].id);
    expect(state.shopping.find((i) => i.name === "玉ねぎ")!.storeId).toBe(
      state.stores[1].id,
    );
    expect(
      state.shopping.find((i) => i.name === "にんじん")!.storeId,
    ).toBeNull();
    state = addMeal(state, other.id);
    expect(state.shopping.find((i) => i.name === "卵")!.storeId).toBe(
      state.stores[3].id,
    );
  });
  it("完了済みから削除した材料は復活せず、将来の不足分だけ新規行の初期店舗へ追加する", () => {
    let { state } = setup();
    state.shopping[0].checked = true;
    state = deleteCompletedShopping(state, state.shopping[0].id);
    state.defaultStoreId = state.stores[3].id;
    expect(syncShopping(state).shopping.some((i) => i.name === "玉ねぎ")).toBe(
      false,
    );
    state = updateMeal(state, state.week.meals[0].id, { servings: 6 });
    const onion = state.shopping.find((i) => i.name === "玉ねぎ")!;
    expect(onion.quantity).toBe(1);
    expect(onion.storeId).toBe(state.stores[3].id);
    expect(onion.checked).toBe(false);
  });
});
