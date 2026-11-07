import { expect, test, type Page } from "@playwright/test";

test.skip(!!process.env.E2E_AUTH, "未接続ビルドのサンプルモードで検証する");
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
  await nav(page, "買い物");
});

test("見出し右側から確認・キャンセル・店舗別と全店舗の一括削除ができ、未購入品を保護する", async ({
  page,
}) => {
  const bulk = page.getByRole("button", {
    name: "完了済みの商品を一括削除",
    exact: true,
  });
  const detail = page.locator("details.shopping-completed");
  const summary = detail.locator("summary");
  const dialog = page.getByRole("dialog");
  await expect(bulk).toBeDisabled();
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  await dialog.getByLabel("商品名", { exact: true }).fill("他店の完了品");
  await dialog
    .getByLabel("購入するお店")
    .selectOption({ label: "業務スーパー" });
  await dialog
    .getByRole("button", { name: "買い物リストに追加", exact: true })
    .click();
  for (const name of ["鶏もも肉", "しょうゆ", "他店の完了品"]) {
    await page
      .getByRole("checkbox", { name: `${name}を購入済みにする`, exact: true })
      .click();
  }
  const pending = await page
    .locator(".shopping-pending .shopping-item")
    .allTextContents();
  await page.getByRole("tab", { name: /カネスエ/ }).click();
  await expect(summary).toContainText("2 商品");
  await expect(detail).toHaveJSProperty("open", false);
  await bulk.click();
  await expect(dialog).toHaveAccessibleName(
    "購入済みの商品2件をまとめて削除しますか？",
  );
  await expect(dialog).toContainText("対象：カネスエ");
  await expect(detail).toHaveJSProperty("open", false);
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(summary).toContainText("2 商品");
  await summary.click();
  await expect(
    page.getByRole("button", {
      name: "鶏もも肉を完了済みから削除",
      exact: true,
    }),
  ).toBeVisible();
  await bulk.click();
  await dialog
    .getByRole("button", { name: "まとめて削除する", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(summary).toContainText("0 商品");
  await expect(bulk).toBeDisabled();
  await expect(detail).toHaveJSProperty("open", true);
  await page.getByRole("tab", { name: /業務スーパー/ }).click();
  await expect(
    page.locator(".shopping-completed .shopping-item"),
  ).toContainText("他店の完了品");
  await page.getByRole("tab", { name: /すべて/ }).click();
  expect(
    await page.locator(".shopping-pending .shopping-item").allTextContents(),
  ).toEqual(pending);
  await bulk.click();
  await expect(dialog).toHaveAccessibleName(
    "購入済みの商品1件をまとめて削除しますか？",
  );
  await expect(dialog).toContainText("対象：すべての店舗");
  await dialog
    .getByRole("button", { name: "まとめて削除する", exact: true })
    .click();
  await expect(page.locator(".shopping-completed .shopping-item")).toHaveCount(
    0,
  );
  expect(
    await page.locator(".shopping-pending .shopping-item").allTextContents(),
  ).toEqual(pending);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await bulk.boundingBox();
    const heading = await summary.locator(":scope > span").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(box!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("複数の自動生成品を一括削除しても再計算・翌週で復活せず、増員分は新しく表示する", async ({
  page,
}) => {
  for (const name of ["鶏もも肉", "玉ねぎ"]) {
    await page
      .getByRole("checkbox", { name: `${name}を購入済みにする`, exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "完了済みの商品を一括削除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "まとめて削除する", exact: true })
    .click();
  await nav(page, "献立");
  await expect(page.locator(".meal-card")).toHaveCount(5);
  const chicken = page
    .locator(".meal-card")
    .filter({ hasText: "鶏もも肉の照り焼き" });
  await chicken.getByRole("checkbox").click();
  await chicken.getByRole("checkbox").click();
  await nav(page, "買い物");
  for (const name of ["鶏もも肉", "玉ねぎ"]) {
    await expect(
      page.locator(".shopping-item").filter({ hasText: name }),
    ).toHaveCount(0);
  }
  await nav(page, "献立");
  await page.getByRole("button", { name: /翌週に切り替える/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "履歴を保存して翌週へ", exact: true })
    .click();
  await nav(page, "買い物");
  for (const name of ["鶏もも肉", "玉ねぎ"]) {
    await expect(
      page.locator(".shopping-item").filter({ hasText: name }),
    ).toHaveCount(0);
  }
  await nav(page, "献立");
  await chicken
    .getByRole("button", {
      name: "鶏もも肉の照り焼きの人数を増やす",
      exact: true,
    })
    .click();
  await nav(page, "買い物");
  await expect(
    page
      .locator(".shopping-pending .shopping-item")
      .filter({ hasText: "鶏もも肉" }),
  ).toContainText("150");
});
