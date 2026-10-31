"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Heart,
  Mail,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
import { friendlyError } from "@/lib/supabase";

export function SetupGuide() {
  return (
    <div className="setup-guide">
      <h3>Supabase 接続の3ステップ</h3>
      <ol>
        <li>
          <span>1</span>
          <div>
            <strong>無料のプロジェクトを作成</strong>
            <p>Supabaseで新しいプロジェクトを作成します。</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>データベースを準備</strong>
            <p>
              リポジトリの <code>supabase/schema.sql</code> 全文を SQL Editor
              で実行します。認証とRLSでアカウントごとに保護します。
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>接続情報を設定</strong>
            <p>
              <code>.env.local</code>{" "}
              に以下を設定し、開発サーバーを再起動してください。
            </p>
          </div>
        </li>
      </ol>
      <pre>
        NEXT_PUBLIC_SUPABASE_URL=プロジェクトURL{"\n"}
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=公開用キー
      </pre>
      <p className="muted">
        秘密キーや service_role は使用しません。詳しい手順はリポジトリの{" "}
        <code>docs/SETUP.md</code> にあります。
      </p>
    </div>
  );
}

export function AuthForm({ supabase }: { supabase: SupabaseClient }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="auth-card">
      <div className="eyebrow">YOUR FAMILY KITCHEN</div>
      <h2>
        {mode === "login"
          ? "おかえりなさい"
          : mode === "signup"
            ? "わが家の台所をはじめる"
            : "パスワードを再設定"}
      </h2>
      <p className="muted">同じアカウントなら、スマホでもパソコンでも。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const redirectTo = window.location.origin;
            if (mode === "login") {
              const result = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (result.error) throw result.error;
            } else if (mode === "signup") {
              const result = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: redirectTo },
              });
              if (result.error) throw result.error;
              if (!result.data.session)
                setMessage(
                  "確認メールを送信しました。メール内のリンクを開いてからログインしてください。届かない場合は迷惑メールと登録済みアドレスをご確認ください。",
                );
            } else {
              const result = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
              });
              if (result.error) throw result.error;
              setMessage(
                "登録がある場合は再設定メールが届きます。メール内のリンクを開いてください。",
              );
            }
          } catch (error) {
            setError(friendlyError(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="field">
            メールアドレス
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label className="field">
              パスワード
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={8}
                required
                value={password}
                placeholder="8文字以上"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="callout" role="status">
              <Mail size={18} />
              {message}
            </p>
          )}
          <button className="button primary full" type="submit">
            {busy
              ? "処理中…"
              : mode === "login"
                ? "ログイン"
                : mode === "signup"
                  ? "アカウントを作成"
                  : "再設定メールを送信"}
            <ArrowRight size={18} />
          </button>
        </fieldset>
      </form>
      <div className="auth-links">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setMessage("");
            setError("");
          }}
        >
          {mode === "signup" ? "ログインはこちら" : "はじめての方：新規登録"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "reset" ? "login" : "reset");
            setMessage("");
            setError("");
          }}
        >
          {mode === "reset" ? "ログインに戻る" : "パスワードを忘れた方"}
        </button>
      </div>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        データはアカウントごとに保護されます
      </div>
    </div>
  );
}

export function Welcome({
  supabase,
  onDemo,
}: {
  supabase: SupabaseClient | null;
  onDemo: () => void;
}) {
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <span className="pill">
          <Heart size={14} />
          わが家の、ちょうどいい毎日。
        </span>
        <h1>
          毎日の「何つくろう」を、
          <br />
          <span>かるく。</span>
        </h1>
        <p>
          家族がよろこぶレシピを集めて、
          <br />
          今週の献立と買い物を、ひとつの場所に。
        </p>
        <div className="kitchen-art" aria-hidden="true">
          <div className="art-note">今週も、おいしい一週間。</div>
          <div className="art-plate">
            <span>🥬</span>
            <span>🍅</span>
            <span>🍗</span>
          </div>
          <div className="art-check">
            <Check size={18} />
            買い忘れも、すっきり。
          </div>
          <div className="art-spark">✳</div>
        </div>
        <div className="welcome-features">
          <div>
            <BookOpen size={22} />
            <strong>わが家のレシピ帳</strong>
            <span>人数に合わせて自動換算</span>
          </div>
          <div>
            <ShoppingBasket size={22} />
            <strong>買い物をまとめて</strong>
            <span>お店ごとに、迷わずお買い物</span>
          </div>
          <div>
            <Cloud size={22} />
            <strong>ずっと残せる</strong>
            <span>同じアカウントで端末を共有</span>
          </div>
        </div>
      </div>
      <div className="welcome-side">
        {supabase ? (
          <AuthForm supabase={supabase} />
        ) : (
          <div className="auth-card">
            <span className="eyebrow">LET’S GET READY</span>
            <h2>わが家の台所を準備しよう</h2>
            <p className="muted">
              データをずっと残すために、
              <br />
              最初にSupabaseを接続してください。
            </p>
            <SetupGuide />
          </div>
        )}
        <div className="demo-invite">
          <span>まずは使い心地を見てみたい方へ</span>
          <button
            className="button secondary full"
            type="button"
            onClick={onDemo}
          >
            サンプルで試してみる
            <ArrowRight size={17} />
          </button>
          <small>お試しデータは保存されません。</small>
        </div>
      </div>
    </div>
  );
}

export function PasswordRecovery({
  supabase,
  onComplete,
}: {
  supabase: SupabaseClient;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const result = await supabase.auth.updateUser({ password });
          if (result.error) throw result.error;
          onComplete();
        } catch (error) {
          setError(friendlyError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label className="field">
          新しいパスワード
          <input
            autoFocus
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="button primary full">
          {busy ? "更新中…" : "パスワードを更新"}
        </button>
      </fieldset>
    </form>
  );
}
