import { expect, test } from "@playwright/test";

test.skip(!!process.env.E2E_AUTH, "未接続ビルドのサンプルモードで検証する");
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "買い物", exact: true })
    .click();
});

test("店舗別に未購入と完了済みを分け、開閉・復元・手動商品の削除確認ができる", async ({
  page,
}) => {
  const pending = page.getByRole("region", { name: "買うもの", exact: true });
  const done = page.getByRole("region", {
    name: "完了済みの商品",
    exact: true,
  });
  const disclosure = page.locator(".shopping-completed > summary");
  await page.getByRole("button", { name: "商品を追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("商品名", { exact: true }).fill("キッチンペーパー");
  await dialog.getByLabel("購入するお店").selectOption({ label: "100均" });
  await dialog.getByLabel("カテゴリ").selectOption("日用品");
  await dialog.getByRole("button", { name: "買い物リストに追加" }).click();
  await page.getByRole("tab", { name: /100均/ }).click();
  await expect(pending.locator(".shopping-item")).toHaveCount(1);
  await pending
    .getByRole("checkbox", { name: "キッチンペーパーを購入済みにする" })
    .click();
  await expect(pending.locator(".shopping-item")).toHaveCount(0);
  await expect(disclosure).toContainText("1 商品");
  await expect(done).not.toBeVisible();
  await disclosure.click();
  await expect(done.locator(".shopping-item")).toHaveCount(1);
  await disclosure.click();
  await expect(done).not.toBeVisible();
  await disclosure.click();
  await done
    .getByRole("checkbox", { name: "キッチンペーパーを買うものに戻す" })
    .click();
  await expect(done.locator(".shopping-item")).toHaveCount(0);
  await expect(pending.locator(".shopping-item")).toContainText(
    "キッチンペーパー",
  );
  await pending
    .getByRole("checkbox", { name: "キッチンペーパーを購入済みにする" })
    .click();
  await page.getByRole("tab", { name: /カネスエ/ }).click();
  await expect(done.locator(".shopping-item")).toHaveCount(0);
  await pending
    .getByRole("checkbox", { name: "鶏もも肉を購入済みにする", exact: true })
    .click();
  await expect(done.locator(".shopping-item")).toContainText("鶏もも肉");
  for (const name of [/業務スーパー/, /コストコ/, /お店未定/]) {
    await page.getByRole("tab", { name }).click();
    await expect(pending.locator(".shopping-item")).toHaveCount(0);
    await expect(done.locator(".shopping-item")).toHaveCount(0);
    await expect(page.locator(".shopping-summary")).toContainText(
      "あと 0 商品",
    );
  }
  await page.getByRole("tab", { name: /すべて/ }).click();
  await expect(done.locator(".shopping-item")).toHaveCount(2);
  await page.getByRole("tab", { name: /100均/ }).click();
  const trash = done.getByRole("button", {
    name: "キッチンペーパーを完了済みから削除",
  });
  const target = await trash.boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);
  await trash.click();
  await expect(dialog).toContainText("キッチンペーパー");
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(done.locator(".shopping-item")).toHaveCount(1);
  await trash.click();
  await dialog.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(done.locator(".shopping-item")).toHaveCount(0);
  await expect(pending.locator(".shopping-item")).toHaveCount(0);
  await page.getByRole("tab", { name: /すべて/ }).click();
  await expect(done.locator(".shopping-item")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("完了した自動生成品は再集計で復活せず、増員分だけ現れ、翌週にも購入済みを保つ", async ({
  page,
}) => {
  const pending = page.getByRole("region", { name: "買うもの", exact: true });
  const done = page.getByRole("region", {
    name: "完了済みの商品",
    exact: true,
  });
  const shopping = () =>
    page
      .getByRole("navigation")
      .getByRole("button", { name: "買い物", exact: true })
      .click();
  const meals = () =>
    page
      .getByRole("navigation")
      .getByRole("button", { name: "献立", exact: true })
      .click();
  const deleteChicken = async () => {
    await pending
      .getByRole("checkbox", { name: "鶏もも肉を購入済みにする", exact: true })
      .click();
    await page.locator(".shopping-completed > summary").click();
    await done
      .getByRole("button", { name: "鶏もも肉を完了済みから削除", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "削除する", exact: true })
      .click();
    await expect(
      page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
    ).toHaveCount(0);
  };
  await deleteChicken();
  await meals();
  await expect(page.locator(".meal-card")).toHaveCount(5);
  const chicken = page
    .locator(".meal-card")
    .filter({ hasText: "鶏もも肉の照り焼き" });
  await chicken.getByRole("checkbox").click();
  await chicken.getByRole("checkbox").click();
  await shopping();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toHaveCount(0);
  await meals();
  await chicken
    .getByRole("button", { name: "鶏もも肉の照り焼きの人数を増やす" })
    .click();
  await shopping();
  await expect(
    pending.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toContainText("150");
  await deleteChicken();
  await meals();
  await page.getByRole("button", { name: /翌週に切り替える/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "履歴を保存して翌週へ" })
    .click();
  await expect(page.locator(".meal-card")).toHaveCount(4);
  await shopping();
  await expect(
    page.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toHaveCount(0);
  await meals();
  await chicken
    .getByRole("button", { name: "鶏もも肉の照り焼きの人数を増やす" })
    .click();
  await shopping();
  await expect(
    pending.locator(".shopping-item").filter({ hasText: "鶏もも肉" }),
  ).toContainText("150");
});
