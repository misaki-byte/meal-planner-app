import { expect, test, type Page } from "@playwright/test";

test.skip(!!process.env.E2E_AUTH, "未接続ビルドのサンプルモードで検証する");
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
async function addOmelet(page: Page) {
  await nav(page, "献立");
  await page.getByRole("button", { name: "献立を追加", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ふんわり卵のオムライスを追加", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /選択を終える/ })
    .click();
}
const chosen = (page: Page, label: string) =>
  page
    .getByRole("combobox", { name: label, exact: true })
    .locator("option:checked");
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
});

test("自動生成品・手動商品の初期店舗はカネスエで、別店舗とお店未定への変更を保持する", async ({
  page,
}) => {
  await nav(page, "設定");
  await expect(chosen(page, "買い物の初期店舗")).toHaveText("カネスエ");
  await nav(page, "買い物");
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  await expect(chosen(page, "購入するお店")).toHaveText("カネスエ");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("商品名", { exact: true }).fill("洗剤");
  await dialog.getByLabel("購入するお店").selectOption({ label: "100均" });
  await dialog.getByRole("button", { name: "買い物リストに追加" }).click();
  await addOmelet(page);
  await nav(page, "買い物");
  await page.getByRole("tab", { name: /カネスエ/ }).click();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "卵" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "卵のお店・内容を編集", exact: true })
    .click();
  await expect(chosen(page, "購入するお店")).toHaveText("カネスエ");
  await dialog
    .getByLabel("購入するお店")
    .selectOption({ label: "業務スーパー" });
  await dialog.getByRole("button", { name: "変更を保存", exact: true }).click();
  await page
    .getByRole("button", { name: "玉ねぎのお店・内容を編集", exact: true })
    .click();
  await dialog.getByLabel("購入するお店").selectOption("");
  await dialog.getByRole("button", { name: "変更を保存", exact: true }).click();
  await nav(page, "献立");
  await page
    .getByRole("button", {
      name: "ふんわり卵のオムライスの人数を増やす",
      exact: true,
    })
    .click();
  await nav(page, "買い物");
  await page.getByRole("tab", { name: /業務スーパー/ }).click();
  await expect(page.locator(".shopping-item")).toContainText("卵");
  await expect(page.locator(".shopping-item")).toContainText("10");
  await page.getByRole("tab", { name: /お店未定/ }).click();
  await expect(page.locator(".shopping-item")).toContainText("玉ねぎ");
  await page
    .getByRole("button", { name: "玉ねぎのお店・内容を編集", exact: true })
    .click();
  await expect(chosen(page, "購入するお店")).toHaveText("お店未定");
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("tab", { name: /100均/ }).click();
  await expect(page.locator(".shopping-item")).toContainText("洗剤");
});

test("設定した初期店舗は新規行だけに適用し、初期店舗を削除しても商品は残る", async ({
  page,
}) => {
  await nav(page, "設定");
  await page
    .getByLabel("買い物の初期店舗", { exact: true })
    .selectOption({ label: "コストコ" });
  await page
    .getByRole("button", { name: "初期店舗を保存", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "初期店舗を保存", exact: true }),
  ).toBeDisabled();
  await nav(page, "買い物");
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  await expect(chosen(page, "購入するお店")).toHaveText("コストコ");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("商品名", { exact: true }).fill("ペーパータオル");
  await dialog.getByRole("button", { name: "買い物リストに追加" }).click();
  await addOmelet(page);
  await nav(page, "買い物");
  await page.getByRole("tab", { name: /カネスエ/ }).click();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".shopping-item").filter({ hasText: "玉ねぎ" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: /コストコ/ }).click();
  await expect(page.locator(".shopping-item")).toHaveCount(4);
  await expect(
    page.locator(".shopping-item").filter({ hasText: "卵" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".shopping-item").filter({ hasText: "ペーパータオル" }),
  ).toHaveCount(1);
  await nav(page, "設定");
  await page
    .getByRole("button", { name: "コストコを削除", exact: true })
    .click();
  await expect(dialog).toContainText(
    "買い物の初期店舗も「お店未定」になります",
  );
  await dialog.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(chosen(page, "買い物の初期店舗")).toHaveText("お店未定");
  await nav(page, "買い物");
  await page.getByRole("tab", { name: /お店未定/ }).click();
  await expect(page.locator(".shopping-item")).toHaveCount(4);
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  await expect(chosen(page, "購入するお店")).toHaveText("お店未定");
});
