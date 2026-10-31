import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createState, stateSchema, type PlannerState } from "./model";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;
export function getSupabase() {
  if (
    !url ||
    !key ||
    url.includes("your-project") ||
    key.includes("your-publishable")
  )
    return null;
  try {
    client ??= createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  } catch {
    return null;
  }
}

export class ConflictError extends Error {
  constructor() {
    super(
      "別の端末でデータが更新されています。「再読込」で最新データを取得してから、もう一度操作してください。",
    );
  }
}
export function friendlyError(error: unknown): string {
  if (error instanceof ConflictError) return error.message;
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/Invalid login credentials/i.test(message))
    return "メールアドレスまたはパスワードを確認してください。";
  if (/Email not confirmed/i.test(message))
    return "確認メール内のリンクを開いてからログインしてください。";
  if (/rate limit|too many requests/i.test(message))
    return "操作が集中しています。少し時間をおいてからお試しください。";
  if (/fetch|network|timeout|abort/i.test(message))
    return "通信できませんでした。接続を確認し、再読込して保存状況を確認してください。";
  if (/planner_data|save_planner|schema cache|PGRST/i.test(message))
    return "データベースの準備を確認してください。設定ガイドのSQLをSupabaseのSQL Editorで実行してください。";
  if (/password/i.test(message))
    return "パスワードは8文字以上で設定してください。";
  return "処理できませんでした。接続とSupabaseの設定を確認し、再読込してからお試しください。";
}

export async function savePlanner(
  supabase: SupabaseClient,
  state: PlannerState,
  revision: number,
) {
  const validated = stateSchema.parse(state);
  const { data, error } = await supabase
    .rpc("save_planner", {
      p_document: validated,
      p_expected_revision: revision,
    })
    .abortSignal(AbortSignal.timeout(20_000));
  if (error?.code === "40001") throw new ConflictError();
  if (error) throw error;
  if (typeof data !== "number") throw new Error("Invalid server revision");
  return data;
}
export async function loadPlanner(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ state: PlannerState; revision: number }> {
  const read = () =>
    supabase
      .from("planner_data")
      .select("document, revision")
      .eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(20_000))
      .maybeSingle();
  const result = await read();
  if (result.error) throw result.error;
  if (result.data)
    return {
      state: stateSchema.parse(result.data.document),
      revision: result.data.revision,
    };
  const state = createState();
  try {
    return { state, revision: await savePlanner(supabase, state, 0) };
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    const raced = await read();
    if (raced.error || !raced.data) throw raced.error ?? error;
    return {
      state: stateSchema.parse(raced.data.document),
      revision: raced.data.revision,
    };
  }
}
