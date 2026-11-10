import { expect, test } from "@playwright/test";

test.skip(!!process.env.E2E_AUTH, "未接続のサンプルモードで確認する");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで試してみる" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "レシピ", exact: true })
    .click();
});

test("スマホで材料をまとめて貼り付け、要確認の行を修正して新規登録できる", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(page.url()).origin)
      requests.push(request.url());
  });
  await page.getByRole("button", { name: "レシピを追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("料理名", { exact: true }).fill("貼り付けテスト");
  await dialog
    .getByLabel("材料をまとめて貼り付ける")
    .fill(
      "【材料（2人分）】\n・玉ねぎ 1/2個\n●豚肉 300g\nA しょうゆ 大さじ2\n塩 少々\n秘密の材料",
    );
  await dialog
    .getByRole("button", { name: "材料を解析する", exact: true })
    .click();
  await expect(
    dialog.getByRole("spinbutton", { name: "基準人数 人分", exact: true }),
  ).toHaveValue("4");
  await dialog.getByRole("button", { name: "2人分を基準人数にする" }).click();
  await expect(
    dialog.getByRole("spinbutton", { name: "基準人数 人分", exact: true }),
  ).toHaveValue("2");
  await expect(
    dialog.locator(".ingredient-editor .ingredient-row"),
  ).toHaveCount(1);
  await expect(dialog.getByLabel("解析結果1の分量")).toHaveValue("0.5");
  await expect(dialog.getByLabel("解析結果4の単位")).toHaveValue("少々");
  const add = dialog.getByRole("button", { name: "確認した5行を食材欄に追加" });
  await expect(add).toBeDisabled();
  await expect(dialog.locator(".bulk-review-card").last()).toContainText(
    "秘密の材料",
  );
  await dialog.getByLabel("解析結果5の名前").fill("にんじん");
  await dialog.getByLabel("解析結果5の分量").fill("1");
  await dialog.getByLabel("解析結果5の単位").fill("本");
  await dialog.getByLabel("解析結果5のカテゴリ").selectOption("野菜・果物");
  await dialog.getByLabel("解析結果5を確認済みにする").check();
  await dialog.getByLabel("解析結果2の分量").fill("350");
  await expect(add).toBeEnabled();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await add.click();
  await expect(
    dialog.locator(".ingredient-editor .ingredient-row"),
  ).toHaveCount(5);
  await expect(dialog.getByLabel("食材2の分量")).toHaveValue("350");
  await dialog
    .getByRole("button", { name: "レシピを保存", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "レシピを検索" })
    .fill("貼り付けテスト");
  await expect(page.locator(".recipe-card")).toHaveCount(1);
  await page.locator(".recipe-card-main").click();
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  await expect(dialog.getByLabel("食材1の分量")).toHaveValue("0.5");
  await expect(dialog.getByLabel("食材4の単位")).toHaveValue("少々");
  await expect(dialog.getByLabel("食材5の名前")).toHaveValue("にんじん");
  await expect(
    dialog.getByRole("spinbutton", { name: "基準人数 人分", exact: true }),
  ).toHaveValue("2");
  expect(requests).toEqual([]);
});

test("編集中の食材を保ち、未追加の解析結果・再解析・重複を確認できる", async ({
  page,
}) => {
  await page
    .getByRole("searchbox", { name: "レシピを検索" })
    .fill("鶏もも肉の照り焼き");
  await page.locator(".recipe-card-main").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  const originalNames = await dialog
    .locator(".ingredient-editor .ingredient-name input")
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  const paste = dialog.getByLabel("材料をまとめて貼り付ける");
  await paste.fill("しょうゆ 大さじ1\n玉ねぎ 1/2個");
  await dialog
    .getByRole("button", { name: "材料を解析する", exact: true })
    .click();
  await expect(dialog.locator(".bulk-review-card").first()).toContainText(
    "同じ食材名・単位",
  );
  await expect(
    dialog.getByRole("button", { name: "確認した2行を食材欄に追加" }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "レシピを保存", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("食材欄に追加するか");
  await paste.fill("玉ねぎ 1個");
  await expect(
    dialog.getByRole("button", { name: "確認した2行を食材欄に追加" }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "現在の解析結果を破棄して再解析" })
    .click();
  await expect(dialog.getByLabel("解析結果1の分量")).toHaveValue("1");
  await dialog
    .getByRole("button", { name: "貼り付け内容を破棄", exact: true })
    .click();
  expect(
    await dialog
      .locator(".ingredient-editor .ingredient-name input")
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      ),
  ).toEqual(originalNames);
  await paste.fill("しょうゆ 大さじ1\n玉ねぎ 1/2個");
  await dialog
    .getByRole("button", { name: "材料を解析する", exact: true })
    .click();
  await dialog.getByLabel("解析結果1を確認済みにする").check();
  await dialog.getByRole("checkbox", { name: "解析結果2を追加する" }).uncheck();
  await dialog
    .getByRole("button", { name: "確認した1行を食材欄に追加" })
    .click();
  expect(
    await dialog
      .locator(".ingredient-editor .ingredient-name input")
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      ),
  ).toEqual([...originalNames, "しょうゆ"]);
  await expect(dialog.getByLabel("食材1の分量")).toHaveValue("600");
  await expect(dialog.getByLabel("食材2の分量")).toHaveValue("2");
  await expect(dialog.getByLabel("食材4の分量")).toHaveValue("1");
  await dialog.getByRole("button", { name: "食材を追加", exact: true }).click();
  await dialog.getByLabel("食材5の名前").fill("卵");
  await dialog
    .getByRole("button", { name: "レシピを保存", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".recipe-card-main").click();
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  await expect(dialog.getByLabel("食材5の名前")).toHaveValue("卵");
});

test("幅360pxで別行の材料を確認・編集し、個別入力も併用して保存できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "レシピを追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("料理名", { exact: true }).fill("別行コピーレシピ");
  await expect(
    dialog.getByRole("list", { name: "一括登録の手順" }),
  ).toBeVisible();
  await dialog
    .getByLabel("材料をまとめて貼り付ける")
    .fill(
      "【材料（2人分）】\n玉ねぎ\n1/2個\n豚肉・・・300g\nA しょうゆ\n大さじ：2\n塩\n少々\n材料の補足文",
    );
  await dialog
    .getByRole("button", { name: "材料を解析する", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "解析結果（5行）" }),
  ).toBeFocused();
  await expect(dialog.locator(".bulk-summary")).toHaveText(
    "追加対象 5行・確認待ち 1行",
  );
  await expect(dialog.getByLabel("解析結果1の分量")).toHaveValue("0.5");
  await expect(dialog.getByLabel("解析結果3の単位")).toHaveValue("大さじ");
  await dialog.getByLabel("解析結果3の分量").fill("1.5");
  await dialog
    .getByRole("checkbox", { name: "解析結果5を追加する", exact: true })
    .uncheck();
  await expect(dialog.locator(".bulk-summary")).toHaveText(
    "追加対象 4行・確認待ち 0行",
  );
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog
    .getByRole("button", { name: "確認した4行を食材欄に追加" })
    .click();
  await dialog.getByRole("button", { name: "食材を追加", exact: true }).click();
  await dialog.getByLabel("食材5の名前").fill("卵");
  await dialog
    .getByRole("button", { name: "レシピを保存", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "レシピを検索" })
    .fill("別行コピーレシピ");
  await page.locator(".recipe-card-main").click();
  await dialog.getByRole("button", { name: "レシピ帳を編集" }).click();
  await expect(dialog.getByLabel("食材1の分量")).toHaveValue("0.5");
  await expect(dialog.getByLabel("食材3の分量")).toHaveValue("1.5");
  await expect(dialog.getByLabel("食材5の名前")).toHaveValue("卵");
});
