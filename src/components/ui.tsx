"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, Minus } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="閉じる"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Counter({
  value,
  onChange,
  label = "人数",
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="counter" aria-label={label}>
      <button
        type="button"
        aria-label={`${label}を減らす`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </button>
      <span>
        {value}
        <small>人</small>
      </span>
      <button
        type="button"
        aria-label={`${label}を増やす`}
        disabled={disabled || value >= 100}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function RecipeEmoji({ name }: { name: string }) {
  const emoji = /鶏|唐揚|照り/.test(name)
    ? "🍗"
    : /魚|鮭|さば|ホイル/.test(name)
      ? "🐟"
      : /サラダ|ほうれん|野菜|和え/.test(name)
        ? "🥬"
        : /汁|スープ|煮/.test(name)
          ? "🥣"
          : /カレー|米|丼/.test(name)
            ? "🍛"
            : /卵|オム/.test(name)
              ? "🍳"
              : /麺|パスタ|うどん/.test(name)
                ? "🍝"
                : "🍽️";
  return (
    <span className="recipe-emoji" aria-hidden="true">
      {emoji}
    </span>
  );
}
