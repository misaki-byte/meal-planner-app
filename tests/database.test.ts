import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createState } from "../src/lib/model";

// Execute the actual migration in PostgreSQL (WASM). Auth roles/uid are fixtures only.
const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${A}'), ('${B}');`);
  await db.exec(
    readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
}, 30_000);
afterAll(async () => {
  await db.close();
});
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const save = (revision: number) =>
  db.query<{ save_planner: number }>(
    "select public.save_planner($1::jsonb,$2)",
    [JSON.stringify(createState()), revision],
  );

describe.sequential("実際のSQL: 認証・RLS・競合制御", () => {
  it("ログインアカウントにデータを作成する", async () => {
    await asUser(A);
    expect((await save(0)).rows[0].save_planner).toBe(1);
    expect(
      (await db.query("select * from public.planner_data")).rows,
    ).toHaveLength(1);
  });
  it("別アカウントは他人の行を読めず、書換え・なりすまし登録もできない", async () => {
    await asUser(B);
    expect(
      (await db.query("select * from public.planner_data")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.planner_data set revision=99 where user_id=$1 returning user_id",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.planner_data(user_id,document) values($1,$2::jsonb)",
        [A, JSON.stringify(createState())],
      ),
    ).rejects.toThrow();
    expect((await save(0)).rows[0].save_planner).toBe(1);
    expect(
      (await db.query("select user_id from public.planner_data")).rows,
    ).toEqual([{ user_id: B }]);
  });
  it("古い端末のrevisionは拒否して、保存済みデータを保護する", async () => {
    await asUser(A);
    expect((await save(1)).rows[0].save_planner).toBe(2);
    await expect(save(1)).rejects.toThrow("Revision conflict");
    expect(
      (await db.query("select revision from public.planner_data")).rows,
    ).toEqual([{ revision: 2 }]);
  });
  it("不正な文書は保存しない", async () => {
    await asUser(A);
    await expect(
      db.query("select public.save_planner('{}'::jsonb,2)"),
    ).rejects.toThrow();
    expect(
      (await db.query("select revision from public.planner_data")).rows,
    ).toEqual([{ revision: 2 }]);
  });
  it("未ログインではテーブル・保存RPCへのアクセスを拒否する", async () => {
    await db.exec("reset role; set role anon;");
    await expect(
      db.query("select * from public.planner_data"),
    ).rejects.toThrow();
    await expect(save(0)).rejects.toThrow();
  });
});
