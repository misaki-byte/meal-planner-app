"use client";

import { useId, useState } from "react";
import {
  CATEGORIES,
  ingredientKey,
  ingredientSchema,
  newId,
  type Ingredient,
} from "@/lib/model";
import {
  parseIngredients,
  type IngredientParseResult,
  type ParsedIngredient,
} from "@/lib/ingredient-parser";

type ReviewRow = ParsedIngredient & {
  id: string;
  included: boolean;
  acknowledged: boolean;
};

export function BulkIngredients({
  existing,
  servings,
  onServings,
  onAppend,
  onPendingChange,
}: {
  existing: Ingredient[];
  servings: number;
  onServings: (value: number) => void;
  onAppend: (ingredients: Ingredient[]) => string | null;
  onPendingChange: (pending: boolean) => void;
}) {
  const helpId = useId();
  const [text, setText] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [result, setResult] = useState<IngredientParseResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [message, setMessage] = useState("");
  const selected = rows.filter((r) => r.included);
  const changed = text !== parsedText;
  const duplicate = (row: ReviewRow) =>
    existing.some(
      (i) =>
        ingredientKey(i.name, i.unit) === ingredientKey(row.name, row.unit),
    ) ||
    rows.some(
      (r) =>
        r.id !== row.id &&
        r.included &&
        ingredientKey(r.name, r.unit) === ingredientKey(row.name, row.unit),
    );
  const valid = (row: ReviewRow) => ingredientSchema.safeParse(row).success;
  const needsReview = (row: ReviewRow) =>
    row.issues.length > 0 || duplicate(row);
  const ready =
    selected.length > 0 &&
    selected.every((r) => valid(r) && (!needsReview(r) || r.acknowledged));
  const update = (id: string, patch: Partial<ReviewRow>) => {
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setMessage("");
  };
  const clear = () => {
    setText("");
    setParsedText("");
    setResult(null);
    setRows([]);
    onPendingChange(false);
  };

  return (
    <section className="bulk-ingredients" aria-label="材料の一括入力">
      <label className="field">
        材料をまとめて貼り付ける
        <textarea
          rows={7}
          value={text}
          aria-describedby={helpId}
          placeholder={
            "【材料（2人分）】\n・玉ねぎ 1/2個\n●豚肉 300g\nA しょうゆ 大さじ2\n塩 少々"
          }
          onChange={(e) => {
            setText(e.target.value);
            setMessage("");
            onPendingChange(!!e.target.value.trim() || result !== null);
          }}
        />
      </label>
      <p id={helpId} className="muted">
        YouTubeの概要欄や料理サイトの材料を、1行ずつまとめて貼り付けてください。
        端末内で解析し、確認後に食材欄へ追加します。
      </p>
      <div className="bulk-actions">
        <button
          type="button"
          className="button secondary"
          disabled={!text.trim()}
          onClick={() => {
            const parsed = parseIngredients(text);
            setResult(parsed);
            setParsedText(text);
            setRows(
              parsed.ingredients.map((r) => ({
                ...r,
                id: newId(),
                included: true,
                acknowledged: false,
              })),
            );
            setMessage("");
            onPendingChange(true);
          }}
        >
          {result ? "現在の解析結果を破棄して再解析" : "材料を解析する"}
        </button>
        {(text || result) && (
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              clear();
              setMessage(
                "貼り付け内容と解析結果を破棄しました。食材欄は変わりません。",
              );
            }}
          >
            貼り付け内容を破棄
          </button>
        )}
      </div>

      {result && (
        <div className="bulk-preview">
          <h3>解析結果（{rows.length}行）</h3>
          <p className="muted">
            食材欄への追加前に、各行を修正できます。追加する行にチェックを付けてください。既存の食材は残ります。
          </p>
          <p className="muted">
            「少々」「適量」などは分量1・その言葉を単位として扱います。人数に応じた換算も数値として計算されます。
          </p>
          {changed && (
            <p className="form-error" role="status">
              貼り付け内容が変わっています。再解析してから追加してください。再解析すると現在の修正内容は破棄されます。
            </p>
          )}
          {result.servings.length > 0 && (
            <div className="bulk-servings">
              <p>基準人数の候補（現在 {servings}人分）</p>
              {result.servings.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    onServings(s.value);
                    setMessage(
                      `基準人数を${s.value}人分に変更しました。食材の分量は変えていません。`,
                    );
                  }}
                >
                  {s.value}人分を基準人数にする
                </button>
              ))}
              <p className="muted">
                候補を選んだときだけ人数を変更します。原文：
                {result.servings.map((s) => s.source).join(" / ")}
              </p>
            </div>
          )}
          {result.headings.length > 0 && (
            <details className="bulk-headings">
              <summary>
                見出し・人数として扱った行（{result.headings.length}行）
              </summary>
              <ul>
                {result.headings.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </details>
          )}
          {rows.length === 0 && (
            <p role="status">
              材料の行が見つかりませんでした。貼り付け内容を確認してください。
            </p>
          )}
          <div className="bulk-review-list">
            {rows.map((row, index) => {
              const prefix = `解析結果${index + 1}`;
              const review = needsReview(row);
              return (
                <div key={row.id} className="bulk-review-card">
                  <label className="bulk-choice">
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={(e) =>
                        update(row.id, { included: e.target.checked })
                      }
                    />
                    {prefix}を追加する
                  </label>
                  <p className="bulk-source">
                    原文（{row.line}行目）：{row.source}
                  </p>
                  <div className="bulk-fields">
                    <label className="field bulk-name">
                      食材名
                      <input
                        aria-label={`${prefix}の名前`}
                        value={row.name}
                        maxLength={100}
                        onChange={(e) =>
                          update(row.id, {
                            name: e.target.value,
                            acknowledged: false,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      分量
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`${prefix}の分量`}
                        min="0.0001"
                        max="1000000"
                        step="any"
                        value={row.quantity ?? ""}
                        onChange={(e) =>
                          update(row.id, {
                            quantity:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            acknowledged: false,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      単位
                      <input
                        aria-label={`${prefix}の単位`}
                        value={row.unit}
                        maxLength={20}
                        list="units"
                        onChange={(e) =>
                          update(row.id, {
                            unit: e.target.value,
                            acknowledged: false,
                          })
                        }
                      />
                    </label>
                    <label className="field bulk-category">
                      カテゴリ
                      <select
                        aria-label={`${prefix}のカテゴリ`}
                        value={row.category}
                        onChange={(e) =>
                          update(row.id, {
                            category: e.target.value as Ingredient["category"],
                            acknowledged: false,
                          })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {review && (
                    <div className="bulk-review-notice">
                      <strong>要確認</strong>
                      {row.issues.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                      {duplicate(row) && (
                        <p>
                          同じ食材名・単位の行があります。上書きせず別の行として追加します。
                        </p>
                      )}
                      <label className="bulk-choice">
                        <input
                          type="checkbox"
                          aria-label={`${prefix}を確認済みにする`}
                          checked={row.acknowledged}
                          onChange={(e) =>
                            update(row.id, { acknowledged: e.target.checked })
                          }
                        />
                        原文と内容を確認しました
                      </label>
                    </div>
                  )}
                  {row.included && !valid(row) && (
                    <p className="form-error">
                      食材名・0より大きい分量・単位を入力してください。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {rows.length > 0 && (
            <>
              {!ready && (
                <p className="muted">
                  追加する行の未入力項目を修正し、「要確認」の内容を確認してください。
                </p>
              )}
              <button
                type="button"
                className="button secondary full"
                disabled={!ready || changed}
                onClick={() => {
                  const additions = selected.map((r) =>
                    ingredientSchema.parse(r),
                  );
                  const error = onAppend(additions);
                  if (error) {
                    setMessage(error);
                    return;
                  }
                  clear();
                  setMessage(
                    `${additions.length}行を食材欄に追加しました。最後に「レシピを保存」を押してください。`,
                  );
                }}
              >
                確認した{selected.length}行を食材欄に追加
              </button>
            </>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="callout">
          {message}
        </p>
      )}
    </section>
  );
}
