"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChefHat,
  ChevronRight,
  Cloud as CloudCheck,
  Download,
  History,
  Leaf,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBasket,
  SlidersHorizontal,
  Sprout,
  Star,
  Store,
  Trash2,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import {
  addMeal,
  CATEGORIES,
  deleteStore,
  formatQuantity,
  newId,
  removeMeal,
  rollover,
  updateMeal,
  weekLabel,
  type Meal,
  type PlannerState,
  type Recipe,
  type ShoppingItem,
} from "@/lib/model";
import { usePlanner } from "@/lib/use-planner";
import { friendlyError } from "@/lib/supabase";
import { PasswordRecovery, SetupGuide, Welcome } from "./auth";
import { RecipeForm, ShoppingForm, StoreForm } from "./forms";
import { Counter, Empty, Modal, RecipeEmoji } from "./ui";

type Tab = "meals" | "shopping" | "recipes" | "settings";
const navigation = [
  { id: "meals" as const, label: "献立", icon: CalendarDays },
  { id: "shopping" as const, label: "買い物", icon: ShoppingBasket },
  { id: "recipes" as const, label: "レシピ", icon: BookOpen },
  { id: "settings" as const, label: "設定", icon: Settings },
];
type Editor =
  | { type: "recipe"; recipe?: Recipe }
  | { type: "shopping"; item?: ShoppingItem }
  | { type: "store"; id?: string; name?: string };
type Confirm = {
  title: string;
  description: string;
  action: () => Promise<boolean>;
  label: string;
};

export default function Planner() {
  const app = usePlanner();
  const { state, demo, saving, loading, error, notice } = app;
  const [tab, setTab] = useState<Tab>("meals");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [picker, setPicker] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<{
    recipe: Recipe;
    servings: number;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const closeEditor = () => {
    setEditor(null);
    app.setError("");
  };
  const changeTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openRecipe = (recipe: Recipe, servings = state?.defaultServings ?? 4) =>
    setDetail({ recipe, servings });
  const saveRecipe = async (recipe: Recipe) => {
    const ok = await app.commit((s) => ({
      ...s,
      recipes: s.recipes.some((r) => r.id === recipe.id)
        ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r))
        : [...s.recipes, recipe],
    }));
    if (ok) setEditor(null);
    return ok;
  };
  const deleteRecipe = (recipe: Recipe) => {
    setDetail(null);
    setConfirm({
      title: "レシピを削除しますか？",
      description: `「${recipe.name}」をレシピ帳から削除します。献立と過去の履歴には登録時の内容が残ります。`,
      label: "削除する",
      action: () =>
        app.commit(
          (s) => ({
            ...s,
            recipes: s.recipes.filter((r) => r.id !== recipe.id),
          }),
          "レシピを削除しました",
        ),
    });
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            type="button"
            aria-label="まいにちの台所 献立へ"
            onClick={() => changeTab("meals")}
          >
            <span className="brand-icon">
              <Sprout size={25} />
            </span>
            <span>
              まいにちの台所<small>わが家のごはん、これひとつ。</small>
            </span>
          </button>
          <div className="header-right">
            {state ? (
              <>
                <span className={`save-status ${demo ? "is-demo" : ""}`}>
                  {saving ? (
                    <RefreshCw size={15} className="spin" />
                  ) : !app.online ? (
                    <WifiOff size={15} />
                  ) : (
                    <CloudCheck size={16} />
                  )}
                  <span>
                    {demo
                      ? "お試しモード"
                      : saving
                        ? "保存中…"
                        : !app.online
                          ? "オフライン"
                          : "クラウド保存"}
                  </span>
                </span>
                {!demo && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void app.refresh()}
                    disabled={saving || loading}
                    aria-label="再読込"
                  >
                    <RefreshCw size={19} className={loading ? "spin" : ""} />
                  </button>
                )}
              </>
            ) : (
              <span className="header-tag">
                <Leaf size={16} />
                家族のための献立ノート
              </span>
            )}
          </div>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>サンプルでお試し中 · 変更は保存されません</span>
          <button
            type="button"
            onClick={() => {
              app.exitDemo();
              setTab("meals");
            }}
          >
            お試しを終了
            <X size={14} />
          </button>
        </div>
      )}
      {!app.online && (
        <div className="offline-banner">
          <WifiOff size={17} />
          オフラインです。保存・最新データの取得には接続が必要です。
        </div>
      )}
      <main id="main-content" className="main-content">
        {error && (
          <div className="alert error" role="alert">
            <div>
              <strong>操作を完了できませんでした</strong>
              <p>{error}</p>
            </div>
            {app.session && !demo && (
              <button
                className="button secondary"
                disabled={saving || loading}
                onClick={() => void app.refresh()}
              >
                再読込
              </button>
            )}
          </div>
        )}
        <div className="sr-only" role="status" aria-live="polite">
          {notice}
        </div>
        {notice && (
          <div className="toast" aria-hidden="true">
            <Check size={16} />
            {notice}
            <button
              type="button"
              aria-label="通知を閉じる"
              onClick={() => app.setNotice("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!app.authReady ? (
          <div className="loading">
            <Sprout size={32} className="pulse" />
            <p>台所を準備しています…</p>
          </div>
        ) : !app.session && !demo ? (
          <Welcome supabase={app.supabase} onDemo={app.startDemo} />
        ) : !state ? (
          <div className="loading">
            <Sprout size={32} />
            <h2>
              {loading
                ? "保存したデータを読み込んでいます…"
                : "データを読み込めませんでした"}
            </h2>
            {!loading && (
              <button
                className="button primary"
                onClick={() => void app.refresh()}
              >
                もう一度読み込む
              </button>
            )}
          </div>
        ) : (
          <>
            <fieldset disabled={saving || loading} className="page-fieldset">
              {tab === "meals" && (
                <MealsView
                  state={state}
                  onAdd={() => setPicker(true)}
                  onHistory={() => setHistoryOpen(true)}
                  onShopping={() => changeTab("shopping")}
                  onDetail={(m) => openRecipe(m.recipe, m.servings)}
                  onChange={(id, patch) =>
                    void app.commit((s) => updateMeal(s, id, patch))
                  }
                  onRemove={(m) =>
                    setConfirm({
                      title: "献立から外しますか？",
                      description: `「${m.recipe.name}」を今週の献立から外し、買い物リストを再計算します。手動追加品は残ります。`,
                      label: "献立から外す",
                      action: () => app.commit((s) => removeMeal(s, m.id)),
                    })
                  }
                  onRollover={() =>
                    setConfirm({
                      title: "翌週へ切り替えますか？",
                      description: `今週の${state.week.meals.length}品を履歴に保存します。未調理の${state.week.meals.filter((m) => !m.cooked).length}品と未購入の${state.shopping.filter((i) => !i.checked).length}商品を翌週へ引き継ぎます。購入済み商品は整理され、購入済みの食材は再追加されません。`,
                      label: "履歴を保存して翌週へ",
                      action: () =>
                        app.commit(rollover, "翌週へ切り替えました"),
                    })
                  }
                />
              )}
              {tab === "shopping" && (
                <ShoppingView
                  state={state}
                  onAdd={() => setEditor({ type: "shopping" })}
                  onEdit={(item) => setEditor({ type: "shopping", item })}
                  onToggle={(id) =>
                    void app.commit(
                      (s) => ({
                        ...s,
                        shopping: s.shopping.map((i) =>
                          i.id === id ? { ...i, checked: !i.checked } : i,
                        ),
                      }),
                      "購入チェックを保存しました",
                    )
                  }
                />
              )}
              {tab === "recipes" && (
                <RecipesView
                  state={state}
                  onAdd={() => setEditor({ type: "recipe" })}
                  onDetail={openRecipe}
                  onPick={(recipe) =>
                    void app.commit(
                      (s) => addMeal(s, recipe.id),
                      "今週の献立に追加しました",
                    )
                  }
                />
              )}
              {tab === "settings" && (
                <SettingsView
                  state={state}
                  demo={demo}
                  email={app.session?.user.email}
                  saving={saving}
                  onDefault={(n) =>
                    app.commit((s) => ({ ...s, defaultServings: n }))
                  }
                  onStore={(store) => setEditor({ type: "store", ...store })}
                  onDeleteStore={(store) =>
                    setConfirm({
                      title: "お店を削除しますか？",
                      description: `「${store.name}」を削除します。このお店の商品は「お店未定」に移動します。商品と履歴は残ります。`,
                      label: "削除する",
                      action: () => app.commit((s) => deleteStore(s, store.id)),
                    })
                  }
                  onHistory={() => setHistoryOpen(true)}
                  onLogout={() => {
                    if (demo) {
                      app.exitDemo();
                      return;
                    }
                    setConfirm({
                      title: "ログアウトしますか？",
                      description:
                        "保存済みのデータはSupabaseに残ります。同じアカウントでログインすると続きを使えます。",
                      label: "ログアウト",
                      action: async () => {
                        const result = await app.supabase!.auth.signOut();
                        if (result.error) {
                          app.setError(friendlyError(result.error));
                          return false;
                        }
                        setTab("meals");
                        return true;
                      },
                    });
                  }}
                />
              )}
            </fieldset>
            <footer className="page-footer">
              <Sprout size={14} />
              <span>おいしい毎日を、少しずつ。</span>
            </footer>
          </>
        )}
      </main>
      {state && (
        <nav className="bottom-nav" aria-label="メインナビゲーション">
          <div>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? "page" : undefined}
                onClick={() => changeTab(id)}
              >
                <span>
                  <Icon size={23} />
                  {id === "shopping" &&
                    state.shopping.some((i) => !i.checked) && <i />}
                </span>
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
      {state && editor && (
        <Modal
          title={
            editor.type === "recipe"
              ? editor.recipe
                ? "レシピを編集"
                : "新しいレシピ"
              : editor.type === "shopping"
                ? editor.item
                  ? "買い物の内容を編集"
                  : "買い物を手動追加"
                : editor.id
                  ? "お店を編集"
                  : "お店を追加"
          }
          onClose={closeEditor}
          busy={saving}
          wide={editor.type === "recipe"}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {editor.type === "recipe" && (
            <RecipeForm
              recipe={editor.recipe}
              defaultServings={state.defaultServings}
              saving={saving}
              onSave={saveRecipe}
            />
          )}
          {editor.type === "shopping" && (
            <>
              <ShoppingForm
                item={editor.item}
                state={state}
                saving={saving}
                onSave={async (item) => {
                  const ok = await app.commit((s) => ({
                    ...s,
                    shopping: s.shopping.some((i) => i.id === item.id)
                      ? s.shopping.map((i) => (i.id === item.id ? item : i))
                      : [...s.shopping, item],
                  }));
                  if (ok) setEditor(null);
                  return ok;
                }}
              />
              {editor.item?.source === "manual" && (
                <button
                  className="button text-danger full spaced"
                  disabled={saving}
                  onClick={() => {
                    const item = editor.item!;
                    setEditor(null);
                    setConfirm({
                      title: "商品を削除しますか？",
                      description: `「${item.name}」を買い物リストから削除します。`,
                      label: "削除する",
                      action: () =>
                        app.commit((s) => ({
                          ...s,
                          shopping: s.shopping.filter((i) => i.id !== item.id),
                        })),
                    });
                  }}
                >
                  <Trash2 size={17} />
                  この商品を削除
                </button>
              )}
            </>
          )}
          {editor.type === "store" && (
            <StoreForm
              name={editor.name}
              saving={saving}
              onSave={async (name) => {
                if (
                  state.stores.some(
                    (s) => s.id !== editor.id && s.name === name,
                  )
                ) {
                  app.setError("同じ名前のお店がすでに登録されています。");
                  return false;
                }
                const ok = await app.commit((s) => ({
                  ...s,
                  stores: editor.id
                    ? s.stores.map((store) =>
                        store.id === editor.id ? { ...store, name } : store,
                      )
                    : [...s.stores, { id: newId(), name }],
                }));
                if (ok) setEditor(null);
                return ok;
              }}
            />
          )}
        </Modal>
      )}
      {state && picker && (
        <Modal
          title="レシピから献立に追加"
          onClose={() => setPicker(false)}
          busy={saving}
        >
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <RecipePicker
            state={state}
            saving={saving}
            onAdd={(id) =>
              void app.commit((s) => addMeal(s, id), "献立に追加しました")
            }
            onNew={() => {
              setPicker(false);
              setEditor({ type: "recipe" });
            }}
          />
          <button
            className="button primary full spaced"
            disabled={saving}
            onClick={() => setPicker(false)}
          >
            選択を終える（今週 {state.week.meals.length}品）
          </button>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.recipe.name} onClose={() => setDetail(null)}>
          <RecipeDetail recipe={detail.recipe} servings={detail.servings} />
          {state?.recipes.some((r) => r.id === detail.recipe.id) && (
            <div className="detail-actions">
              <button
                className="button secondary"
                onClick={() => {
                  const recipe = state.recipes.find(
                    (r) => r.id === detail.recipe.id,
                  )!;
                  setDetail(null);
                  setEditor({ type: "recipe", recipe });
                }}
              >
                <Pencil size={17} />
                レシピ帳を編集
              </button>
              <button
                className="icon-button danger"
                aria-label="レシピを削除"
                onClick={() => deleteRecipe(detail.recipe)}
              >
                <Trash2 size={19} />
              </button>
            </div>
          )}
        </Modal>
      )}
      {state && historyOpen && (
        <Modal
          title="これまでの献立"
          onClose={() => setHistoryOpen(false)}
          wide
        >
          <HistoryView state={state} />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          busy={saving}
          onClose={() => {
            setConfirm(null);
            app.setError("");
          }}
        >
          <p className="confirm-description">{confirm.description}</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setConfirm(null)}
            >
              キャンセル
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={async () => {
                if (await confirm.action()) setConfirm(null);
              }}
            >
              {saving ? "処理中…" : confirm.label}
            </button>
          </div>
        </Modal>
      )}
      {app.recovery && app.supabase && (
        <Modal
          title="パスワードの再設定"
          onClose={() => app.setRecovery(false)}
        >
          <PasswordRecovery
            supabase={app.supabase}
            onComplete={() => {
              app.setRecovery(false);
              app.setNotice("パスワードを更新しました");
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}

function MealsView({
  state,
  onAdd,
  onHistory,
  onShopping,
  onDetail,
  onChange,
  onRemove,
  onRollover,
}: {
  state: PlannerState;
  onAdd: () => void;
  onHistory: () => void;
  onShopping: () => void;
  onDetail: (m: Meal) => void;
  onChange: (
    id: string,
    patch: Partial<Pick<Meal, "cooked" | "servings">>,
  ) => void;
  onRemove: (m: Meal) => void;
  onRollover: () => void;
}) {
  const cooked = state.week.meals.filter((m) => m.cooked).length;
  const pending = state.shopping.filter((i) => !i.checked).length;
  return (
    <>
      <PageHeading
        eyebrow="WEEKLY MENU"
        title="今週の献立"
        description="食べたいものを、わが家のペースで。"
      >
        <button
          className="button secondary"
          aria-label="献立履歴"
          onClick={onHistory}
        >
          <History size={18} />
          <span>献立履歴</span>
        </button>
        <button className="button primary" onClick={onAdd}>
          <Plus size={19} />
          献立を追加
        </button>
      </PageHeading>
      <section className="week-summary" aria-label="今週の進み具合">
        <div className="week-intro">
          <span className="week-label">
            <CalendarDays size={16} />
            {weekLabel(state.week.startDate)}
          </span>
          <h2>
            {state.week.meals.length
              ? "今週のごはん、準備できました。"
              : "今週は、何をつくろう？"}
          </h2>
          <p>まずは5〜6品。つくらなかった料理は、翌週に引き継げます。</p>
        </div>
        <div className="week-stats">
          <div>
            <strong>
              {state.week.meals.length}
              <small>品</small>
            </strong>
            <span>今週の献立</span>
          </div>
          <div>
            <strong>
              {cooked}
              <small>品</small>
            </strong>
            <span>つくった料理</span>
          </div>
          <div className="summary-sprout" aria-hidden="true">
            <Sprout size={50} strokeWidth={1.2} />
          </div>
        </div>
      </section>
      <div className="content-columns">
        <section className="meal-section">
          <div className="section-line">
            <h2>
              わが家の今週リスト
              <span className="count-pill">{state.week.meals.length}</span>
            </h2>
            <span className="muted">
              {cooked} / {state.week.meals.length} 品できた！
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${state.week.meals.length ? (cooked / state.week.meals.length) * 100 : 0}%`,
              }}
            />
          </div>
          {!state.week.meals.length ? (
            <Empty
              icon={<ChefHat size={32} />}
              title="今週の献立を決めましょう"
              description="レシピ帳から好きな料理を選ぶと、買い物リストも自動でできあがります。"
              action={
                <button className="button primary" onClick={onAdd}>
                  <Plus size={18} />
                  レシピから選ぶ
                </button>
              }
            />
          ) : (
            <div className="meal-list">
              {state.week.meals.map((meal, index) => (
                <article
                  className={`meal-card ${meal.cooked ? "is-cooked" : ""}`}
                  key={meal.id}
                >
                  <div className="meal-card-top">
                    <RecipeEmoji name={meal.recipe.name} />
                    <div className="meal-info">
                      <div className="meal-meta">
                        <span>MENU {String(index + 1).padStart(2, "0")}</span>
                        {meal.carried && (
                          <span className="carry-badge">前週から</span>
                        )}
                      </div>
                      <button
                        className="title-button"
                        onClick={() => onDetail(meal)}
                      >
                        {meal.recipe.name}
                      </button>
                      <span className="rating">
                        <Star size={13} fill="currentColor" />
                        {meal.recipe.rating}
                        <span>家族ウケ度</span>
                      </span>
                    </div>
                    <button
                      className="icon-button muted"
                      aria-label={`${meal.recipe.name}を献立から外す`}
                      onClick={() => onRemove(meal)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="meal-card-bottom">
                    <Counter
                      value={meal.servings}
                      label={`${meal.recipe.name}の人数`}
                      onChange={(n) => onChange(meal.id, { servings: n })}
                    />
                    <label className="cooked-check">
                      <input
                        type="checkbox"
                        checked={meal.cooked}
                        onChange={() =>
                          onChange(meal.id, { cooked: !meal.cooked })
                        }
                      />
                      <span className="check-visual">
                        <Check size={15} />
                      </span>
                      {meal.cooked ? "つくった！" : "作った"}
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!!state.week.meals.length && (
            <button className="add-dashed" onClick={onAdd}>
              <Plus size={20} />
              もう一品、献立に追加する
            </button>
          )}
        </section>
        <aside className="weekly-aside">
          <div className="shopping-promo">
            <span className="promo-icon">
              <ShoppingBasket size={28} />
            </span>
            <h3>お買い物も、まとめて。</h3>
            <p>
              献立に必要な食材は
              <br />
              リストにしておきました。
            </p>
            <div className="promo-count">
              <strong>{pending}</strong>
              <span>商品が未購入</span>
            </div>
            <button className="button primary full" onClick={onShopping}>
              買い物リストへ
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="weekly-tip">
            <span className="eyebrow">KITCHEN NOTE</span>
            <h3>
              <Leaf size={17} />
              がんばりすぎない献立を。
            </h3>
            <p>
              同じ料理を何度選んでも大丈夫。家族の「また食べたい」を、今週も。
            </p>
          </div>
          <button className="rollover-button" onClick={onRollover}>
            <RefreshCw size={18} />
            <span>
              翌週に切り替える<small>今週の献立は履歴に保存</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </aside>
      </div>
    </>
  );
}

function ShoppingView({
  state,
  onAdd,
  onEdit,
  onToggle,
}: {
  state: PlannerState;
  onAdd: () => void;
  onEdit: (i: ShoppingItem) => void;
  onToggle: (id: string) => void;
}) {
  const [store, setStore] = useState("all");
  const [hideChecked, setHideChecked] = useState(false);
  const checked = state.shopping.filter((i) => i.checked).length;
  const matches = (i: ShoppingItem) =>
    store === "all" || (store === "none" ? !i.storeId : i.storeId === store);
  const filtered = state.shopping
    .filter(matches)
    .filter((i) => !hideChecked || !i.checked);
  return (
    <>
      <PageHeading
        eyebrow="SHOPPING LIST"
        title="買い物リスト"
        description="必要なものを、いつものお店で。"
      >
        <button className="button primary" onClick={onAdd}>
          <Plus size={19} />
          商品を追加
        </button>
      </PageHeading>
      <div className="shopping-summary">
        <span className="summary-icon">
          <ShoppingBasket size={27} />
        </span>
        <div>
          <strong>あと {state.shopping.length - checked} 商品</strong>
          <p>献立の食材を自動集計 · 手動追加もずっと残ります</p>
        </div>
        <span className="shopping-fraction">
          {checked}
          <small> / {state.shopping.length} 購入済み</small>
        </span>
      </div>
      <div className="store-tabs" role="tablist" aria-label="購入するお店">
        {[
          { id: "all", name: "すべて" },
          ...state.stores,
          { id: "none", name: "お店未定" },
        ].map((s) => (
          <button
            type="button"
            role="tab"
            aria-selected={store === s.id}
            aria-controls="shopping-panel"
            id={`tab-${s.id}`}
            key={s.id}
            onClick={() => setStore(s.id)}
          >
            {s.id !== "all" && <Store size={15} />} {s.name}
            <span>
              {
                state.shopping.filter(
                  (i) =>
                    !i.checked &&
                    (s.id === "all" ||
                      (s.id === "none" ? !i.storeId : i.storeId === s.id)),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="section-line shopping-toolbar">
        <span className="muted">同じ食材・単位は自動でひとまとめ</span>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={hideChecked}
            onChange={(e) => setHideChecked(e.target.checked)}
          />
          購入済みを隠す
        </label>
      </div>
      <div id="shopping-panel" role="tabpanel" aria-labelledby={`tab-${store}`}>
        {!filtered.length ? (
          <Empty
            icon={<CheckCheck size={32} />}
            title={
              state.shopping.length
                ? "このリストはすっきり！"
                : "買い物リストはまだ空です"
            }
            description={
              state.shopping.length
                ? "ほかのお店のリストや、購入済みの商品も確認できます。"
                : "献立を選ぶと食材が自動で追加されます。日用品などは手動で追加できます。"
            }
            action={
              <button className="button secondary" onClick={onAdd}>
                <Plus size={17} />
                商品を追加
              </button>
            }
          />
        ) : (
          <div className="shopping-categories">
            {CATEGORIES.map((category) => {
              const items = filtered
                .filter((i) => i.category === category)
                .sort((a, b) => Number(a.checked) - Number(b.checked));
              if (!items.length) return null;
              return (
                <section className="shopping-category" key={category}>
                  <div className="category-heading">
                    <h2>{category}</h2>
                    <span>{items.filter((i) => !i.checked).length} 商品</span>
                  </div>
                  {items.map((item) => (
                    <div
                      className={`shopping-item ${item.checked ? "is-checked" : ""}`}
                      key={item.id}
                    >
                      <label className="shopping-check">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => onToggle(item.id)}
                          aria-label={`${item.name}を購入済みにする`}
                        />
                        <span className="check-visual">
                          <Check size={22} />
                        </span>
                        <span className="shopping-item-info">
                          <strong>
                            {item.name}
                            <span className="item-quantity">
                              {formatQuantity(item.quantity)}
                              <small>{item.unit}</small>
                            </span>
                          </strong>
                          <span className="item-meta">
                            {state.stores.find((s) => s.id === item.storeId)
                              ?.name ?? "お店未定"}
                            {item.source === "manual" && (
                              <span className="manual-badge">手動追加</span>
                            )}
                            {item.carryQuantity > 0 && (
                              <span>引継ぎ分を含む</span>
                            )}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${item.name}のお店・内容を編集`}
                        onClick={() => onEdit(item)}
                      >
                        <SlidersHorizontal size={18} />
                      </button>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <div className="shopping-footnote">
        <CloudCheck size={16} />
        <p>
          チェックは自動保存。食材が増えたときは、買い忘れを防ぐためチェックが外れます。
        </p>
      </div>
    </>
  );
}

function RecipesView({
  state,
  onAdd,
  onDetail,
  onPick,
}: {
  state: PlannerState;
  onAdd: () => void;
  onDetail: (r: Recipe) => void;
  onPick: (r: Recipe) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const recipes = state.recipes.filter((r) =>
    `${r.name} ${r.ingredients.map((i) => i.name).join(" ")}`
      .normalize("NFKC")
      .toLowerCase()
      .includes(query.normalize("NFKC").toLowerCase()),
  );
  const ordered =
    sort === "rating"
      ? [...recipes].sort((a, b) => b.rating - a.rating)
      : [...recipes].reverse();
  return (
    <>
      <PageHeading
        eyebrow="FAMILY RECIPES"
        title="わが家のレシピ帳"
        description="家族の「おいしい！」を、集めていこう。"
      >
        <button className="button primary" onClick={onAdd}>
          <Plus size={19} />
          レシピを追加
        </button>
      </PageHeading>
      <div className="recipe-toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            type="search"
            aria-label="レシピを検索"
            placeholder="料理名・食材で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="sort-field">
          <span className="sr-only">並び順</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">新しい順</option>
            <option value="rating">家族ウケ度順</option>
          </select>
        </label>
      </div>
      <div className="section-line">
        <h2>
          お気に入りの定番<span className="count-pill">{ordered.length}</span>
        </h2>
        <span className="muted">人数に合わせて分量を自動換算</span>
      </div>
      {!ordered.length ? (
        <Empty
          icon={<BookOpen size={32} />}
          title={
            query ? "レシピが見つかりません" : "最初のレシピを残しましょう"
          }
          description={
            query
              ? "料理名や食材のキーワードを変えてみてください。"
              : "定番の料理も、家族に好評だった一品も。少しずつ増やしていけます。"
          }
          action={
            !query && (
              <button className="button primary" onClick={onAdd}>
                レシピを追加
              </button>
            )
          }
        />
      ) : (
        <div className="recipe-grid">
          {ordered.map((recipe) => (
            <article key={recipe.id} className="recipe-card">
              <button
                className="recipe-card-main"
                onClick={() => onDetail(recipe)}
              >
                <div className="recipe-art">
                  <RecipeEmoji name={recipe.name} />
                  <span className="recipe-rating">
                    <Star size={13} fill="currentColor" />
                    {recipe.rating}
                  </span>
                </div>
                <div className="recipe-card-content">
                  <h3>{recipe.name}</h3>
                  <p>{recipe.ingredients.map((i) => i.name).join("・")}</p>
                  <span>
                    <Users size={14} />
                    {recipe.servings}人分のレシピ
                  </span>
                </div>
              </button>
              <button
                className="recipe-add"
                onClick={() => onPick(recipe)}
                aria-label={`${recipe.name}を今週の献立に追加`}
              >
                <Plus size={16} />
                今週の献立に追加
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function RecipePicker({
  state,
  saving,
  onAdd,
  onNew,
}: {
  state: PlannerState;
  saving: boolean;
  onAdd: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const recipes = state.recipes.filter((r) =>
    `${r.name} ${r.ingredients.map((i) => i.name).join(" ")}`
      .normalize("NFKC")
      .toLowerCase()
      .includes(query.normalize("NFKC").toLowerCase()),
  );
  return (
    <>
      <p className="muted">
        5〜6品を目安に。同じレシピを何度追加してもOKです。
      </p>
      <label className="search-field spaced">
        <Search size={18} />
        <input
          autoFocus
          type="search"
          aria-label="追加するレシピを検索"
          placeholder="料理名・食材で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {!recipes.length ? (
        <Empty
          icon={<BookOpen size={28} />}
          title={query ? "該当するレシピがありません" : "まずはレシピを登録"}
          description="レシピ帳に登録した料理から選べます。"
          action={
            <button className="button secondary" onClick={onNew}>
              レシピを登録する
            </button>
          }
        />
      ) : (
        <div className="picker-list">
          {recipes.map((r) => (
            <div className="picker-row" key={r.id}>
              <RecipeEmoji name={r.name} />
              <div>
                <strong>{r.name}</strong>
                <span className="muted">
                  ★ {r.rating} · 今週{" "}
                  {state.week.meals.filter((m) => m.recipe.id === r.id).length}
                  品
                </span>
              </div>
              <button
                className="icon-button pick-button"
                aria-label={`${r.name}を追加`}
                disabled={saving}
                onClick={() => onAdd(r.id)}
              >
                <Plus size={21} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RecipeDetail({
  recipe,
  servings,
}: {
  recipe: Recipe;
  servings: number;
}) {
  const [people, setPeople] = useState(servings);
  return (
    <>
      <div className="detail-intro">
        <RecipeEmoji name={recipe.name} />
        <div>
          <span className="rating">
            <Star size={15} fill="currentColor" />
            {recipe.rating} <span>家族ウケ度</span>
          </span>
          <p className="muted">基準：{recipe.servings}人分</p>
        </div>
      </div>
      <div className="detail-servings">
        <strong>分量を確認</strong>
        <Counter value={people} onChange={setPeople} />
      </div>
      <p className="muted small">
        この人数変更は分量の確認用です。献立の人数は献立画面で変更できます。
      </p>
      <ul className="detail-ingredients">
        {recipe.ingredients.map((i) => (
          <li key={i.id}>
            <span>{i.name}</span>
            <strong>
              {formatQuantity((i.quantity * people) / recipe.servings)}{" "}
              <small>{i.unit}</small>
            </strong>
          </li>
        ))}
      </ul>
      {recipe.notes && (
        <div className="recipe-notes">
          <h3>作り方・メモ</h3>
          <p>{recipe.notes}</p>
        </div>
      )}
    </>
  );
}

function SettingsView({
  state,
  demo,
  email,
  saving,
  onDefault,
  onStore,
  onDeleteStore,
  onHistory,
  onLogout,
}: {
  state: PlannerState;
  demo: boolean;
  email?: string;
  saving: boolean;
  onDefault: (n: number) => Promise<boolean>;
  onStore: (store?: { id: string; name: string }) => void;
  onDeleteStore: (s: { id: string; name: string }) => void;
  onHistory: () => void;
  onLogout: () => void;
}) {
  const [people, setPeople] = useState(state.defaultServings);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-planner-${state.week.startDate}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeading
        eyebrow="KITCHEN SETTINGS"
        title="わが家の設定"
        description="家族に合わせて、使いやすく。"
      />
      <div className="settings-grid">
        <section className="settings-card">
          <h2>
            <Users size={20} />
            家族の人数
          </h2>
          <p className="muted">
            新しい献立・レシピに使う初期人数です。登録済みの献立は変わりません。
          </p>
          <form
            className="default-servings"
            onSubmit={async (e) => {
              e.preventDefault();
              if (people >= 1 && people <= 100) await onDefault(people);
            }}
          >
            <label>
              初期人数
              <div className="input-suffix">
                <input
                  aria-label="初期人数"
                  type="number"
                  required
                  min="1"
                  max="100"
                  step="1"
                  value={people || ""}
                  onChange={(e) => setPeople(Number(e.target.value))}
                />
                <span>人</span>
              </div>
            </label>
            <button
              type="submit"
              className="button secondary"
              disabled={saving || people === state.defaultServings}
            >
              保存
            </button>
          </form>
        </section>
        <section className="settings-card account-card">
          <h2>
            <CloudCheck size={20} />
            アカウントと保存
          </h2>
          <strong className="account-email">
            {demo ? "お試しモード" : email}
          </strong>
          <p className="muted">
            {demo
              ? "サンプルの変更は保存されません。実際に使うにはSupabaseを接続してログインしてください。"
              : "データはSupabaseに自動保存されます。他の端末でも同じアカウントでログインしてください。"}
          </p>
          <button className="button secondary" onClick={onLogout}>
            <LogOut size={17} />
            {demo ? "お試しを終了" : "ログアウト"}
          </button>
        </section>
        <section className="settings-card stores-card">
          <div className="section-line">
            <h2>
              <Store size={20} />
              いつものお店
            </h2>
            <button
              className="button secondary compact"
              onClick={() => onStore()}
            >
              <Plus size={17} />
              追加
            </button>
          </div>
          <p className="muted">
            お店を削除しても、商品は「お店未定」に残ります。
          </p>
          <div className="stores-list">
            {state.stores.map((store) => (
              <div key={store.id}>
                <span className="store-symbol">
                  <Store size={18} />
                </span>
                <strong>{store.name}</strong>
                <button
                  className="icon-button"
                  aria-label={`${store.name}を編集`}
                  onClick={() => onStore(store)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`${store.name}を削除`}
                  onClick={() => onDeleteStore(store)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {!state.stores.length && (
              <p>「追加」からお店を登録してください。</p>
            )}
          </div>
        </section>
        <section className="settings-card">
          <h2>
            <BookOpen size={20} />
            記録を残す
          </h2>
          <button className="settings-link" onClick={onHistory}>
            <History size={19} />
            <span>
              過去の献立を見る<small>{state.history.length}週間分の記録</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="settings-link" onClick={exportData}>
            <Download size={19} />
            <span>
              データを書き出す
              <small>レシピ・献立・買い物・履歴のJSONバックアップ</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <p className="muted small">
            書き出したファイルにはご家庭のデータが含まれます。ご自身で保管してください。
          </p>
        </section>
        <section className="settings-card install-card">
          <h2>
            <Sprout size={20} />
            ホーム画面から、すぐ台所へ
          </h2>
          <p>
            iPhone：Safariの共有メニュー →「ホーム画面に追加」
            <br />
            Android：Chromeのメニュー
            →「アプリをインストール」または「ホーム画面に追加」
          </p>
          <p className="muted small">
            HTTPSで公開後に利用できます。保存と最新データの取得にはインターネット接続が必要です。
          </p>
        </section>
        {demo && (
          <section className="settings-card">
            <SetupGuide />
          </section>
        )}
      </div>
    </>
  );
}

function HistoryView({ state }: { state: PlannerState }) {
  return !state.history.length ? (
    <Empty
      icon={<History size={30} />}
      title="これから記録が増えていきます"
      description="「翌週に切り替える」で、今週の献立と買い物リストがここに保存されます。"
    />
  ) : (
    <div className="history-list">
      {state.history.map((week) => (
        <details key={week.id} className="history-week">
          <summary>
            <span>
              <CalendarDays size={18} />
              <strong>{weekLabel(week.startDate)}</strong>
            </span>
            <span>
              {week.meals.filter((m) => m.cooked).length} / {week.meals.length}{" "}
              品 調理済み
              <ChevronRight size={17} />
            </span>
          </summary>
          <div className="history-content">
            {week.meals.map((meal) => (
              <div className="history-meal" key={meal.id}>
                <RecipeEmoji name={meal.recipe.name} />
                <div>
                  <strong>{meal.recipe.name}</strong>
                  <small>
                    {meal.servings}人分 ·{" "}
                    {meal.cooked ? "調理済み" : "翌週へ引き継ぎ"}
                  </small>
                  <details>
                    <summary>食材・メモを見る</summary>
                    <ul>
                      {meal.recipe.ingredients.map((i) => (
                        <li key={i.id}>
                          {i.name}：
                          {formatQuantity(
                            (i.quantity * meal.servings) / meal.recipe.servings,
                          )}{" "}
                          {i.unit}
                        </li>
                      ))}
                    </ul>
                    {meal.recipe.notes && (
                      <p className="pre-wrap">{meal.recipe.notes}</p>
                    )}
                  </details>
                </div>
                {meal.cooked && <Check size={20} />}
              </div>
            ))}
            <details className="history-shopping">
              <summary>買い物の記録（{week.shopping.length}商品）</summary>
              <ul>
                {week.shopping.map((i) => (
                  <li key={i.id}>
                    {i.checked ? "✓" : "○"} {i.name}{" "}
                    {formatQuantity(i.quantity)}
                    {i.unit} ·{" "}
                    {state.stores.find((s) => s.id === i.storeId)?.name ??
                      "当時のお店は削除済み・未設定"}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </details>
      ))}
    </div>
  );
}
