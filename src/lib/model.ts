import { z } from "zod";

export const CATEGORIES = [
  "野菜・果物",
  "肉・魚",
  "卵・乳製品",
  "豆腐・加工品",
  "米・麺・パン",
  "調味料",
  "日用品",
  "その他",
] as const;
const id = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const quantity = z.number().finite().positive().max(1_000_000);
const servings = z.number().int().min(1).max(100);
export const ingredientSchema = z.object({
  id,
  name,
  quantity,
  unit: z.string().trim().min(1).max(20),
  category: z.enum(CATEGORIES),
});
export const recipeSchema = z.object({
  id,
  name,
  servings,
  rating: z.number().int().min(1).max(5),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  notes: z.string().max(5000),
});
export const mealSchema = z.object({
  id,
  recipe: recipeSchema,
  servings,
  cooked: z.boolean(),
  carried: z.boolean(),
  stocked: z.record(z.string(), z.number().finite().nonnegative()),
});
export const shoppingSchema = z.object({
  id,
  source: z.enum(["auto", "manual"]),
  name,
  quantity,
  unit: z.string().trim().min(1).max(20),
  category: z.enum(CATEGORIES),
  storeId: id.nullable(),
  checked: z.boolean(),
  carryQuantity: z.number().finite().nonnegative(),
});
const weekSchema = z.object({
  id,
  startDate: z.iso.date(),
  meals: z.array(mealSchema).max(200),
});
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  defaultServings: servings,
  defaultStoreId: id.nullable().optional(),
  recipes: z.array(recipeSchema).max(2000),
  stores: z.array(z.object({ id, name })).max(100),
  week: weekSchema,
  shopping: z.array(shoppingSchema).max(5000),
  history: z.array(
    weekSchema.extend({
      archivedAt: z.iso.datetime(),
      shopping: z.array(shoppingSchema),
    }),
  ),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type ShoppingItem = z.infer<typeof shoppingSchema>;
export type PlannerState = z.infer<typeof stateSchema>;
export type Category = (typeof CATEGORIES)[number];

export const newId = () => crypto.randomUUID();
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 10000) / 10000;
export const formatQuantity = (n: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(n);
const normalize = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
// JSON encoding prevents collisions between ingredient names and unit delimiters.
export const ingredientKey = (name: string, unit: string) =>
  JSON.stringify([normalize(name), normalize(unit)]);

/** Older documents have no defaultStoreId. Resolve their existing Kanesue only;
 * never add a deleted store or change assignments on existing shopping rows.
 * Explicit null means the user selected "お店未定" (or deleted the default).
 */
export function getDefaultStoreId(
  state: Pick<PlannerState, "stores" | "defaultStoreId">,
): string | null {
  if (state.defaultStoreId === undefined)
    return (
      state.stores.find((s) => normalize(s.name) === "カネスエ")?.id ?? null
    );
  return state.stores.some((s) => s.id === state.defaultStoreId)
    ? state.defaultStoreId
    : null;
}
export function monday(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekLabel(date: string) {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
    });
  return `${fmt(date)} — ${fmt(addDays(date, 6))}`;
}
export function createState(): PlannerState {
  const stores = ["カネスエ", "業務スーパー", "100均", "コストコ"].map(
    (name) => ({
      id: newId(),
      name,
    }),
  );
  return {
    schemaVersion: 1,
    defaultServings: 4,
    defaultStoreId: stores[0].id,
    recipes: [],
    stores,
    week: { id: newId(), startDate: monday(), meals: [] },
    shopping: [],
    history: [],
  };
}

export function mealIngredients(meal: Meal) {
  const map = new Map<string, Ingredient>();
  for (const ingredient of meal.recipe.ingredients) {
    const key = ingredientKey(ingredient.name, ingredient.unit);
    const amount = (ingredient.quantity * meal.servings) / meal.recipe.servings;
    const previous = map.get(key);
    map.set(key, {
      ...ingredient,
      quantity: round((previous?.quantity ?? 0) + amount),
    });
  }
  return map;
}

/** Recipe demand and carried extras share one auto row. Manual rows are independent. */
export function syncShopping(state: PlannerState): PlannerState {
  const demand = new Map<string, Ingredient>();
  for (const meal of state.week.meals) {
    for (const [key, ingredient] of mealIngredients(meal)) {
      const needed = Math.max(
        0,
        ingredient.quantity - (meal.stocked[key] ?? 0),
      );
      const previous = demand.get(key);
      demand.set(key, {
        ...ingredient,
        quantity: round((previous?.quantity ?? 0) + needed),
      });
    }
  }
  const previous = new Map(
    state.shopping
      .filter((i) => i.source === "auto")
      .map((i) => [ingredientKey(i.name, i.unit), i]),
  );
  for (const [key, item] of previous) {
    if (!demand.has(key) && item.carryQuantity > 0)
      demand.set(key, { ...item, quantity: 0 });
  }
  const automatic: ShoppingItem[] = [];
  for (const [key, ingredient] of demand) {
    const old = previous.get(key);
    const amount = round(ingredient.quantity + (old?.carryQuantity ?? 0));
    if (amount <= 0) continue;
    automatic.push({
      id: old?.id ?? newId(),
      source: "auto",
      name: old?.name ?? ingredient.name,
      unit: old?.unit ?? ingredient.unit,
      quantity: amount,
      category: old?.category ?? ingredient.category,
      // null is a deliberate/legacy assignment too. Default only a NEW row.
      storeId: old ? old.storeId : getDefaultStoreId(state),
      carryQuantity: old?.carryQuantity ?? 0,
      checked: !!old?.checked && amount <= old.quantity,
    });
  }
  return {
    ...state,
    shopping: [
      ...automatic,
      ...state.shopping.filter((i) => i.source === "manual"),
    ],
  };
}

export function addMeal(state: PlannerState, recipeId: string): PlannerState {
  const recipe = state.recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new Error("レシピが見つかりません。");
  return syncShopping({
    ...state,
    week: {
      ...state.week,
      meals: [
        ...state.week.meals,
        {
          id: newId(),
          recipe: structuredClone(recipe),
          servings: state.defaultServings,
          cooked: false,
          carried: false,
          stocked: {},
        },
      ],
    },
  });
}
export function updateMeal(
  state: PlannerState,
  id: string,
  patch: Partial<Pick<Meal, "cooked" | "servings">>,
) {
  return syncShopping({
    ...state,
    week: {
      ...state.week,
      meals: state.week.meals.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    },
  });
}
export function removeMeal(state: PlannerState, id: string) {
  return syncShopping({
    ...state,
    week: { ...state.week, meals: state.week.meals.filter((m) => m.id !== id) },
  });
}

/** Removing a completed auto row consumes its demand, using existing meal stock credits.
 * Credits belong to these meal instances: new meals and amounts above the credit still
 * generate shopping rows. No deleted shopping row or new persistence field is needed.
 */
export function deleteCompletedShopping(
  state: PlannerState,
  itemId: string,
): PlannerState {
  return deleteCompletedShoppingItems(state, [itemId]);
}

/** Delete exactly the confirmed IDs in one operation. undefined scope means all
 * stores; null means unassigned. Reject a stale/unsafe selection before changing
 * any rows or credits. Both single and bulk deletion use this implementation.
 */
export function deleteCompletedShoppingItems(
  state: PlannerState,
  itemIds: readonly string[],
  storeId?: string | null,
): PlannerState {
  const ids = new Set(itemIds);
  if (!ids.size) return state;
  const items = state.shopping.filter((i) => ids.has(i.id));
  if (
    items.length !== ids.size ||
    items.some(
      (i) => !i.checked || (storeId !== undefined && i.storeId !== storeId),
    )
  )
    throw new Error("完了済みの商品と店舗を確認し、もう一度操作してください。");
  const purchasedKeys = new Set(
    items
      .filter((i) => i.source === "auto")
      .map((i) => ingredientKey(i.name, i.unit)),
  );
  // Only confirmed rows leave the list. Other rows must not be normalized,
  // merged, or removed as a side effect of deleting completed purchases.
  return {
    ...state,
    shopping: state.shopping.filter((i) => !ids.has(i.id)),
    week: !purchasedKeys.size
      ? state.week
      : {
          ...state.week,
          meals: state.week.meals.map((meal) => {
            const ingredients = mealIngredients(meal);
            const stocked = { ...meal.stocked };
            let changed = false;
            for (const key of purchasedKeys) {
              const required = ingredients.get(key)?.quantity ?? 0;
              if (required > (stocked[key] ?? 0)) {
                stocked[key] = required;
                changed = true;
              }
            }
            return changed ? { ...meal, stocked } : meal;
          }),
        },
  };
}

/** Archive atomically; purchased ingredients for unfinished meals become stock credits. */
export function rollover(state: PlannerState): PlannerState {
  const pending = structuredClone(state.week.meals.filter((m) => !m.cooked));
  const shopping: ShoppingItem[] = [];
  for (const item of state.shopping) {
    if (item.source === "manual") {
      if (!item.checked) shopping.push(item);
      continue;
    }
    const key = ingredientKey(item.name, item.unit);
    if (item.checked) {
      for (const meal of pending) {
        const required = mealIngredients(meal).get(key)?.quantity;
        if (required)
          meal.stocked[key] = Math.max(meal.stocked[key] ?? 0, required);
      }
    } else {
      const cookedDemand = state.week.meals
        .filter((m) => m.cooked)
        .reduce((sum, meal) => {
          const required = mealIngredients(meal).get(key)?.quantity ?? 0;
          return sum + Math.max(0, required - (meal.stocked[key] ?? 0));
        }, 0);
      shopping.push({
        ...item,
        carryQuantity: round(item.carryQuantity + cookedDemand),
      });
    }
  }
  return syncShopping({
    ...state,
    history: [
      {
        ...structuredClone(state.week),
        shopping: structuredClone(state.shopping),
        archivedAt: new Date().toISOString(),
      },
      ...state.history,
    ],
    week: {
      id: newId(),
      startDate: addDays(state.week.startDate, 7),
      meals: pending.map((m) => ({ ...m, id: newId(), carried: true })),
    },
    shopping,
  });
}

export function deleteStore(
  state: PlannerState,
  storeId: string,
): PlannerState {
  return {
    ...state,
    ...(getDefaultStoreId(state) === storeId ? { defaultStoreId: null } : {}),
    stores: state.stores.filter((s) => s.id !== storeId),
    shopping: state.shopping.map((i) =>
      i.storeId === storeId ? { ...i, storeId: null } : i,
    ),
  };
}

export function demoState() {
  let state = createState();
  const sample = (
    name: string,
    rating: number,
    ingredients: [string, number, string, Category][],
    notes: string,
  ): Recipe => ({
    id: newId(),
    name,
    servings: 4,
    rating,
    notes,
    ingredients: ingredients.map(([name, quantity, unit, category]) => ({
      id: newId(),
      name,
      quantity,
      unit,
      category,
    })),
  });
  state.recipes = [
    sample(
      "鶏もも肉の照り焼き",
      5,
      [
        ["鶏もも肉", 600, "g", "肉・魚"],
        ["しょうゆ", 2, "大さじ", "調味料"],
        ["みりん", 2, "大さじ", "調味料"],
      ],
      "皮目からこんがり焼く。仕上げにたれを絡めます。",
    ),
    sample(
      "ほうれん草のごま和え",
      4,
      [
        ["ほうれん草", 2, "束", "野菜・果物"],
        ["しょうゆ", 1, "大さじ", "調味料"],
        ["すりごま", 2, "大さじ", "調味料"],
      ],
      "ゆでたほうれん草の水気をよく絞って和えます。",
    ),
    sample(
      "鮭ときのこのホイル焼き",
      5,
      [
        ["鮭", 4, "切れ", "肉・魚"],
        ["しめじ", 1, "パック", "野菜・果物"],
        ["玉ねぎ", 1, "個", "野菜・果物"],
        ["バター", 20, "g", "卵・乳製品"],
      ],
      "アルミホイルで包み、フライパンで蒸し焼きに。",
    ),
    sample(
      "豚こまと野菜のカレー",
      5,
      [
        ["豚こま肉", 400, "g", "肉・魚"],
        ["玉ねぎ", 2, "個", "野菜・果物"],
        ["にんじん", 1, "本", "野菜・果物"],
        ["カレールー", 4, "皿分", "調味料"],
      ],
      "野菜がやわらかくなったら火を止めてルーを溶かします。",
    ),
    sample(
      "豆腐とわかめのおみそ汁",
      4,
      [
        ["豆腐", 1, "丁", "豆腐・加工品"],
        ["乾燥わかめ", 4, "g", "豆腐・加工品"],
        ["みそ", 3, "大さじ", "調味料"],
      ],
      "みそを入れたら煮立てすぎないように。",
    ),
    sample(
      "ふんわり卵のオムライス",
      5,
      [
        ["卵", 8, "個", "卵・乳製品"],
        ["玉ねぎ", 1, "個", "野菜・果物"],
        ["ご飯", 800, "g", "米・麺・パン"],
        ["ケチャップ", 6, "大さじ", "調味料"],
      ],
      "ケチャップライスを半熟卵で包みます。",
    ),
  ];
  for (const recipe of state.recipes.slice(0, 5))
    state = addMeal(state, recipe.id);
  state = updateMeal(state, state.week.meals[1].id, { cooked: true });
  return state;
}
