import { expect, test } from "@playwright/test";

test.skip(!!process.env.E2E_AUTH, "Supabase未接続の本番ビルドで実行するテスト");

test("接続前ガイドを表示し、お試しから献立・買い物・引継ぎを操作できる", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "わが家の台所を準備しよう" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
  await expect(
    page.getByRole("heading", { name: "今週の献立", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "献立を追加", exact: true }).click();
  const picker = page.getByRole("dialog");
  await picker
    .getByRole("button", { name: "鶏もも肉の照り焼きを追加", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "鶏もも肉の照り焼きを追加", exact: true })
    .click();
  await picker.getByRole("button", { name: /選択を終える/ }).click();
  await expect(page.locator(".meal-card")).toHaveCount(7);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "買い物" })
    .click();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toContainText("1,800");
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("商品名").fill("キッチンペーパー");
  await form.getByLabel("購入するお店").selectOption({ label: "100均" });
  await form.getByLabel("カテゴリ").selectOption("日用品");
  await form.getByRole("button", { name: "買い物リストに追加" }).click();
  await page.getByRole("tab", { name: /100均/ }).click();
  await expect(page.locator(".shopping-item")).toHaveCount(1);
  await expect(page.locator(".shopping-item")).toContainText(
    "キッチンペーパー",
  );
  await page.getByRole("tab", { name: /すべて/ }).click();
  await page
    .getByRole("checkbox", { name: "鶏もも肉を購入済みにする", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "献立", exact: true })
    .click();
  await page.getByRole("button", { name: /翌週に切り替える/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "履歴を保存して翌週へ" })
    .click();
  await expect(page.locator(".meal-card")).toHaveCount(6);
  await page.getByRole("button", { name: "献立履歴" }).click();
  await page.getByRole("dialog").locator(".history-week>summary").click();
  await expect(page.getByRole("dialog").locator(".history-meal")).toHaveCount(
    7,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "買い物" })
    .click();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".shopping-item").filter({ hasText: "キッチンペーパー" }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("レシピの作成・換算・検索・編集・削除と店舗の管理ができる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "レシピ", exact: true })
    .click();
  await page.getByRole("button", { name: "レシピを追加", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("料理名", { exact: true }).fill("テストの卵焼き");
  await dialog.getByLabel("食材1の名前").fill("卵");
  await dialog.getByLabel("食材1の分量").fill("8");
  await dialog.getByRole("button", { name: "星5つ" }).click();
  await dialog.getByRole("button", { name: "レシピを保存" }).click();
  await page.getByRole("searchbox", { name: "レシピを検索" }).fill("テスト");
  await expect(page.locator(".recipe-card")).toHaveCount(1);
  await page.locator(".recipe-card-main").click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "人数を減らす" }).click();
  await expect(dialog.locator(".detail-ingredients")).toContainText("6");
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("料理名", { exact: true })
    .fill("テストの甘い卵焼き");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "レシピを保存" })
    .click();
  await expect(page.locator(".recipe-card")).toContainText(
    "テストの甘い卵焼き",
  );
  await page.locator(".recipe-card-main").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "レシピを削除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する", exact: true })
    .click();
  await expect(page.locator(".recipe-card")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "設定", exact: true })
    .click();
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("dialog").getByLabel("お店の名前").fill("近所のお店");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "お店を保存" })
    .click();
  await expect(page.locator(".stores-list")).toContainText("近所のお店");
  await page.getByRole("button", { name: "近所のお店を編集" }).click();
  await page.getByRole("dialog").getByLabel("お店の名前").fill("新しいお店");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "お店を保存" })
    .click();
  await page.getByRole("button", { name: "新しいお店を削除" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する", exact: true })
    .click();
  await expect(page.locator(".stores-list")).not.toContainText("新しいお店");
});

test("PWAの公開ファイルとオフライン画面が利用できる", async ({
  page,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.context().setOffline(true);
  await page.goto("/offline-check");
  await expect(
    page.getByRole("heading", { name: "ただいまオフラインです" }),
  ).toBeVisible();
});
