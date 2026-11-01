"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="loading">
      <h1>画面を表示できませんでした</h1>
      <p>保存済みのデータはSupabaseに残っています。</p>
      <button className="button primary" onClick={reset}>
        もう一度読み込む
      </button>
    </main>
  );
}
