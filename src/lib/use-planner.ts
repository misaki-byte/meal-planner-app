"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { demoState, stateSchema, type PlannerState } from "./model";
import {
  friendlyError,
  getSupabase,
  loadPlanner,
  savePlanner,
} from "./supabase";

export function usePlanner() {
  const [supabase] = useState(getSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState<PlannerState | null>(null);
  const [demo, setDemo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [online, setOnline] = useState(true);
  const revision = useRef(0);
  const stateRef = useRef<PlannerState | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const userId = session?.user.id;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setError(friendlyError(error));
      setSession(data.session);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        stateRef.current = null;
        setState(null);
        generation.current++;
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!supabase || !userId || busy.current) return;
    const current = ++generation.current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await loadPlanner(supabase, userId);
      if (generation.current !== current) return;
      revision.current = result.revision;
      stateRef.current = result.state;
      setState(result.state);
    } catch (error) {
      if (generation.current === current) setError(friendlyError(error));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (demo) return;
    stateRef.current = null;
    setState(null);
    revision.current = 0;
    if (userId) void refresh();
  }, [userId, demo, refresh]);

  const commit = async (
    transform: (state: PlannerState) => PlannerState,
    message = "保存しました",
  ) => {
    if (!stateRef.current || busy.current) return false;
    if (!demo && !navigator.onLine) {
      setError(
        "オフラインです。インターネットに接続してから操作してください。",
      );
      return false;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    const current = generation.current;
    try {
      const next = stateSchema.parse(
        transform(structuredClone(stateRef.current)),
      );
      let nextRevision = revision.current;
      if (!demo) {
        if (!supabase || !userId) throw new Error("Not signed in");
        nextRevision = await savePlanner(supabase, next, revision.current);
      }
      if (generation.current !== current) return false;
      revision.current = nextRevision;
      stateRef.current = next;
      setState(next);
      setNotice(
        demo ? "お試しデータを更新しました（保存されません）" : message,
      );
      return true;
    } catch (error) {
      setError(friendlyError(error));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const startDemo = () => {
    const next = demoState();
    generation.current++;
    setDemo(true);
    stateRef.current = next;
    setState(next);
    setError("");
    setNotice("");
    window.scrollTo(0, 0);
  };
  const exitDemo = () => {
    setDemo(false);
    stateRef.current = null;
    setState(null);
    setError("");
    setNotice("");
    window.scrollTo(0, 0);
  };
  return {
    supabase,
    session,
    authReady,
    state,
    demo,
    saving,
    loading,
    error,
    notice,
    recovery,
    online,
    setRecovery,
    setError,
    setNotice,
    refresh,
    commit,
    startDemo,
    exitDemo,
  };
}
