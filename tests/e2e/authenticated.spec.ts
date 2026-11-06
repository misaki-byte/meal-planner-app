import {
  expect,
  test,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import type { PlannerState } from "../../src/lib/model";
import { demoState } from "../../src/lib/model";

test.skip(
  !process.env.E2E_AUTH,
  "ダミーの接続先を設定したビルドで、SDKの通信をローカルのテスト用応答に置き換える",
);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
type Row = { document: PlannerState; revision: number };
function user(id: string) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id === A ? "a@example.com" : "b@example.com",
    created_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
}
function token(id: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.test-only`;
}
async function mockApi(context: BrowserContext, rows: Map<string, Row>) {
  await context.route(
    "https://e2e-placeholder.supabase.co/**",
    async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      };
      const json = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 200, headers });
      if (url.pathname.endsWith("/token")) {
        const id = request.postDataJSON().email === "b@example.com" ? B : A;
        return json({
          access_token: token(id),
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: `test-refresh-${id}`,
          user: user(id),
        });
      }
      const authorization = request.headers().authorization ?? "";
      const payload = authorization.split(".")[1];
      const id = payload
        ? JSON.parse(Buffer.from(payload, "base64url").toString()).sub
        : A;
      if (url.pathname.endsWith("/logout"))
        return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith("/user")) return json(user(id));
      if (url.pathname.endsWith("/planner_data"))
        return json(rows.has(id) ? [rows.get(id)] : []);
      if (url.pathname.endsWith("/save_planner")) {
        const { p_document, p_expected_revision } = request.postDataJSON();
        const revision = rows.get(id)?.revision ?? 0;
        if (revision !== p_expected_revision)
          return json({ code: "40001", message: "Revision conflict" }, 409);
        rows.set(id, { document: p_document, revision: revision + 1 });
        return json(revision + 1);
      }
      return json({ message: "Unexpected test request" }, 500);
    },
  );
}

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("test-password-123");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "今週の献立", exact: true }),
  ).toBeVisible();
}

test("完了済みの削除は保存成功後に反映し、再読込・別端末・翌週でも購入済みを維持する", async ({
  page,
  context,
  browser,
}) => {
  const original = demoState();
  const before = structuredClone(original);
  const rows = new Map<string, Row>([[A, { document: original, revision: 1 }]]);
  await mockApi(context, rows);
  await login(page, "a@example.com");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "買い物", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "鶏もも肉を購入済みにする", exact: true })
    .click();
  await page.locator(".shopping-completed > summary").click();
  const trash = page.getByRole("button", {
    name: "鶏もも肉を完了済みから削除",
    exact: true,
  });
  await trash.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "キャンセル", exact: true })
    .click();
  expect(
    rows.get(A)!.document.shopping.some((i) => i.name === "鶏もも肉"),
  ).toBe(true);
  await trash.click();
  const failOnce = (route: Route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      },
      body: JSON.stringify({ message: "Test save failure" }),
    });
  await context.route("**/rest/v1/rpc/save_planner", failOnce);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(
    rows.get(A)!.document.shopping.some((i) => i.name === "鶏もも肉"),
  ).toBe(true);
  await context.unroute("**/rest/v1/rpc/save_planner", failOnce);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = rows.get(A)!.document;
  expect(saved.shopping.some((i) => i.name === "鶏もも肉")).toBe(false);
  expect(saved.recipes).toEqual(before.recipes);
  expect(saved.week.meals.map((m) => m.id)).toEqual(
    before.week.meals.map((m) => m.id),
  );
  expect(saved.shopping.filter((i) => i.name !== "鶏もも肉")).toEqual(
    before.shopping.filter((i) => i.name !== "鶏もも肉"),
  );
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "買い物", exact: true })
    .click();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toHaveCount(0);
  const otherContext = await browser.newContext();
  try {
    await mockApi(otherContext, rows);
    const other = await otherContext.newPage();
    await login(other, "a@example.com");
    await other
      .getByRole("navigation")
      .getByRole("button", { name: "買い物", exact: true })
      .click();
    await expect(
      other.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
    ).toHaveCount(0);
    await other
      .getByRole("navigation")
      .getByRole("button", { name: "献立", exact: true })
      .click();
    await other.getByRole("button", { name: /翌週に切り替える/ }).click();
    await other
      .getByRole("dialog")
      .getByRole("button", { name: "履歴を保存して翌週へ" })
      .click();
    await other
      .getByRole("navigation")
      .getByRole("button", { name: "買い物", exact: true })
      .click();
    await expect(
      other.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
    ).toHaveCount(0);
    expect(rows.get(A)!.document.recipes).toEqual(before.recipes);
  } finally {
    await otherContext.close();
  }
});

test("貼り付けた材料を既存RPCで保存・復元し、登録済みレシピ・献立・買い物を保つ", async ({
  page,
  context,
}) => {
  const original = demoState();
  const before = structuredClone(original);
  const rows = new Map<string, Row>([[A, { document: original, revision: 1 }]]);
  await mockApi(context, rows);
  await login(page, "a@example.com");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "レシピ", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "レシピを検索" })
    .fill(original.recipes[0].name);
  await page.locator(".recipe-card-main").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  await dialog
    .getByLabel("材料をまとめて貼り付ける")
    .fill("【材料（2人分）】\n玉ねぎ 1/2個\n塩 少々");
  await dialog
    .getByRole("button", { name: "材料を解析する", exact: true })
    .click();
  expect(rows.get(A)?.revision).toBe(1);
  await dialog
    .getByRole("button", { name: "確認した2行を食材欄に追加" })
    .click();
  expect(rows.get(A)?.revision).toBe(1);
  await dialog
    .getByRole("button", { name: "レシピを保存", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = rows.get(A)!.document;
  expect(rows.get(A)?.revision).toBe(2);
  expect(saved.recipes[0].ingredients.slice(0, 3)).toEqual(
    before.recipes[0].ingredients,
  );
  expect(
    saved.recipes[0].ingredients
      .slice(3)
      .map((i) => [i.name, i.quantity, i.unit]),
  ).toEqual([
    ["玉ねぎ", 0.5, "個"],
    ["塩", 1, "少々"],
  ]);
  expect(saved.recipes[0].servings).toBe(before.recipes[0].servings);
  expect(saved.recipes.slice(1)).toEqual(before.recipes.slice(1));
  expect(saved.week).toEqual(before.week);
  expect(saved.shopping).toEqual(before.shopping);
  expect(saved.history).toEqual(before.history);
  expect(saved.schemaVersion).toBe(1);
  expect(Object.keys(saved.recipes[0].ingredients[3]).sort()).toEqual(
    ["id", "name", "quantity", "unit", "category"].sort(),
  );
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "レシピ", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "レシピを検索" })
    .fill(original.recipes[0].name);
  await page.locator(".recipe-card-main").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "レシピ帳を編集" })
    .click();
  await expect(page.getByLabel("食材4の分量")).toHaveValue("0.5");
  await expect(page.getByLabel("食材5の単位")).toHaveValue("少々");
});

test("認証SDKから保存し、再起動・別端末で復元する。競合を拒否しログアウトで画面を消去する", async ({
  browser,
}) => {
  const rows = new Map<string, Row>();
  const first = await browser.newContext();
  const second = await browser.newContext();
  await mockApi(first, rows);
  await mockApi(second, rows);
  const page = await first.newPage();
  const other = await second.newPage();
  try {
    await login(page, "a@example.com");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "レシピ", exact: true })
      .click();
    await page
      .getByRole("button", { name: "レシピを追加", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("料理名", { exact: true }).fill("保存するカレー");
    await dialog.getByLabel("食材1の名前").fill("玉ねぎ");
    await dialog.getByRole("button", { name: "レシピを保存" }).click();
    await expect(page.locator(".recipe-card")).toHaveCount(1);
    expect(rows.get(A)?.document.recipes[0].name).toBe("保存するカレー");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "今週の献立", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "レシピ", exact: true })
      .click();
    await expect(page.locator(".recipe-card")).toContainText("保存するカレー");
    await login(other, "a@example.com");
    await other
      .getByRole("navigation")
      .getByRole("button", { name: "レシピ", exact: true })
      .click();
    await expect(other.locator(".recipe-card")).toContainText("保存するカレー");
    await page
      .getByRole("button", { name: "保存するカレーを今週の献立に追加" })
      .click();
    await expect.poll(() => rows.get(A)?.document.week.meals.length).toBe(1);
    await other
      .getByRole("button", { name: "保存するカレーを今週の献立に追加" })
      .click();
    await expect(other.locator("main [role=alert]")).toContainText(
      "別の端末でデータが更新",
    );
    expect(rows.get(A)?.document.week.meals).toHaveLength(1);
    await other
      .getByRole("button", { name: "再読込", exact: true })
      .first()
      .click();
    await expect(other.locator("main [role=alert]")).toHaveCount(0);
    await other
      .getByRole("navigation")
      .getByRole("button", { name: "献立", exact: true })
      .click();
    await expect(other.locator(".meal-card")).toHaveCount(1);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "設定", exact: true })
      .click();
    await page.getByRole("button", { name: "ログアウト", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "ログアウト", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "おかえりなさい" }),
    ).toBeVisible();
    await login(page, "b@example.com");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "レシピ", exact: true })
      .click();
    await expect(page.locator(".recipe-card")).toHaveCount(0);
    expect(rows.get(A)?.document.recipes).toHaveLength(1);
    expect(rows.get(B)?.document.recipes).toHaveLength(0);
  } finally {
    await first.close();
    await second.close();
  }
});
