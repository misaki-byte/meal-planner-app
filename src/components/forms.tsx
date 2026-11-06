"use client";
import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { BulkIngredients } from "./bulk-ingredients";
import { appendImportedIngredients } from "@/lib/ingredient-parser";
import {
  CATEGORIES,
  getDefaultStoreId,
  newId,
  recipeSchema,
  shoppingSchema,
  type PlannerState,
  type Recipe,
  type ShoppingItem,
} from "@/lib/model";

export function RecipeForm({
  recipe,
  defaultServings,
  saving,
  onSave,
}: {
  recipe?: Recipe;
  defaultServings: number;
  saving: boolean;
  onSave: (r: Recipe) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Recipe>(() =>
    structuredClone(
      recipe ?? {
        id: newId(),
        name: "",
        servings: defaultServings,
        rating: 3,
        notes: "",
        ingredients: [
          {
            id: newId(),
            name: "",
            quantity: 1,
            unit: "個",
            category: "野菜・果物",
          },
        ],
      },
    ),
  );
  const [error, setError] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (bulkPending) {
          setError(
            "貼り付けた材料を食材欄に追加するか、貼り付け内容を破棄してから保存してください。",
          );
          return;
        }
        const result = recipeSchema.safeParse(draft);
        if (!result.success) {
          setError(
            "料理名・食材・分量・単位を確認してください。分量は0より大きい数、人数は1〜100人です。",
          );
          return;
        }
        await onSave(result.data);
      }}
    >
      <fieldset disabled={saving}>
        <label className="field">
          料理名
          <input
            autoFocus
            value={draft.name}
            maxLength={100}
            required
            placeholder="例：鶏もも肉の照り焼き"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label className="field">
            基準人数
            <div className="input-suffix">
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                required
                value={draft.servings || ""}
                onChange={(e) =>
                  setDraft({ ...draft, servings: Number(e.target.value) })
                }
              />
              <span>人分</span>
            </div>
          </label>
          <div className="field">
            家族ウケ度
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`星${n}つ`}
                  aria-pressed={draft.rating === n}
                  onClick={() => setDraft({ ...draft, rating: n })}
                >
                  <Star
                    size={24}
                    fill={n <= draft.rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <BulkIngredients
          existing={draft.ingredients}
          servings={draft.servings}
          onServings={(servings) => setDraft({ ...draft, servings })}
          onPendingChange={setBulkPending}
          onAppend={(additions) => {
            // Only the untouched placeholder of a NEW recipe may be replaced.
            // Every row of an existing recipe, including blank rows, is retained.
            const only = draft.ingredients[0];
            const emptyPlaceholder =
              !recipe &&
              draft.ingredients.length === 1 &&
              only.name === "" &&
              only.quantity === 1 &&
              only.unit === "個" &&
              only.category === "野菜・果物";
            try {
              const ingredients = appendImportedIngredients(
                emptyPlaceholder ? [] : draft.ingredients,
                additions,
              );
              setDraft({ ...draft, ingredients });
              setError("");
              return null;
            } catch (error) {
              return error instanceof Error
                ? error.message
                : "材料を追加できませんでした。";
            }
          }}
        />
        {!recipe && (
          <p className="muted">
            新規レシピの最初の空欄が未入力の場合は、確認した材料に置き換えます。
          </p>
        )}
        <div className="section-line">
          <h3>食材</h3>
          <span className="muted">基準人数分の分量を入力</span>
        </div>
        <div className="ingredient-editor">
          {draft.ingredients.map((ingredient, index) => {
            const update = (patch: Partial<typeof ingredient>) =>
              setDraft({
                ...draft,
                ingredients: draft.ingredients.map((i) =>
                  i.id === ingredient.id ? { ...i, ...patch } : i,
                ),
              });
            return (
              <div className="ingredient-row" key={ingredient.id}>
                <label className="field ingredient-name">
                  食材 {index + 1}
                  <input
                    aria-label={`食材${index + 1}の名前`}
                    value={ingredient.name}
                    maxLength={100}
                    required
                    placeholder="例：玉ねぎ"
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label className="field ingredient-amount">
                  分量
                  <input
                    type="number"
                    aria-label={`食材${index + 1}の分量`}
                    min="0.0001"
                    max="1000000"
                    step="any"
                    required
                    value={ingredient.quantity || ""}
                    onChange={(e) =>
                      update({ quantity: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field ingredient-unit">
                  単位
                  <input
                    aria-label={`食材${index + 1}の単位`}
                    value={ingredient.unit}
                    maxLength={20}
                    list="units"
                    required
                    onChange={(e) => update({ unit: e.target.value })}
                  />
                </label>
                <label className="field ingredient-category">
                  カテゴリ
                  <select
                    value={ingredient.category}
                    aria-label={`食材${index + 1}のカテゴリ`}
                    onChange={(e) =>
                      update({
                        category: e.target.value as typeof ingredient.category,
                      })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button danger ingredient-delete"
                  aria-label={`食材${index + 1}を削除`}
                  disabled={draft.ingredients.length === 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      ingredients: draft.ingredients.filter(
                        (i) => i.id !== ingredient.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
        <datalist id="units">
          {[
            "g",
            "kg",
            "個",
            "本",
            "枚",
            "束",
            "丁",
            "パック",
            "切れ",
            "ml",
            "大さじ",
            "小さじ",
            "袋",
            "適量",
            "少々",
            "ひとつまみ",
          ].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <button
          className="button secondary full"
          type="button"
          onClick={() =>
            setDraft({
              ...draft,
              ingredients: [
                ...draft.ingredients,
                {
                  id: newId(),
                  name: "",
                  quantity: 1,
                  unit: "個",
                  category: "野菜・果物",
                },
              ],
            })
          }
        >
          <Plus size={18} />
          食材を追加
        </button>
        <label className="field spaced">
          作り方・メモ（任意）
          <textarea
            rows={4}
            maxLength={5000}
            value={draft.notes}
            placeholder="おいしく作るコツ、家族の好みなど"
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          {saving ? "保存中…" : "レシピを保存"}
        </button>
      </fieldset>
    </form>
  );
}

export function ShoppingForm({
  item,
  state,
  saving,
  onSave,
}: {
  item?: ShoppingItem;
  state: PlannerState;
  saving: boolean;
  onSave: (item: ShoppingItem) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<ShoppingItem>(() =>
    structuredClone(
      item ?? {
        id: newId(),
        source: "manual",
        name: "",
        quantity: 1,
        unit: "個",
        category: "その他",
        storeId: getDefaultStoreId(state),
        checked: false,
        carryQuantity: 0,
      },
    ),
  );
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const result = shoppingSchema.safeParse(draft);
        if (!result.success) {
          setError("商品名・分量・単位を確認してください。");
          return;
        }
        await onSave(result.data);
      }}
    >
      <fieldset disabled={saving}>
        {draft.source === "auto" && (
          <p className="callout">
            分量は献立から自動計算されます。購入するお店とカテゴリを変更できます。
          </p>
        )}
        <label className="field">
          商品名
          <input
            required
            autoFocus
            value={draft.name}
            maxLength={100}
            readOnly={draft.source === "auto"}
            placeholder="例：キッチンペーパー"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label className="field">
            分量
            <input
              type="number"
              min="0.0001"
              max="1000000"
              step="any"
              required
              readOnly={draft.source === "auto"}
              value={draft.quantity || ""}
              onChange={(e) =>
                setDraft({ ...draft, quantity: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            単位
            <input
              maxLength={20}
              required
              readOnly={draft.source === "auto"}
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </label>
        </div>
        <label className="field">
          購入するお店
          <select
            value={draft.storeId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, storeId: e.target.value || null })
            }
          >
            <option value="">お店未定</option>
            {state.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          カテゴリ
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({
                ...draft,
                category: e.target.value as typeof draft.category,
              })
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary full">
          {saving ? "保存中…" : item ? "変更を保存" : "買い物リストに追加"}
        </button>
      </fieldset>
    </form>
  );
}

export function StoreForm({
  name = "",
  saving,
  onSave,
}: {
  name?: string;
  saving: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(name);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (value.trim()) await onSave(value.trim());
      }}
    >
      <fieldset disabled={saving}>
        <label className="field">
          お店の名前
          <input
            autoFocus
            required
            maxLength={100}
            value={value}
            placeholder="例：近所のスーパー"
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button type="submit" className="button primary full">
          {saving ? "保存中…" : "お店を保存"}
        </button>
      </fieldset>
    </form>
  );
}
