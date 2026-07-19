"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  defaultSchoolPlatformState,
  loadSchoolPlatformState,
  saveSchoolPlatformState,
  type SchoolPlatformState,
} from "@/lib/schoolPlatform";

type CloudPayload = { mode: "cloud"; manager: boolean; state: SchoolPlatformState };

const unavailableCloudState: SchoolPlatformState = {
  school: {
    id: "",
    name: "School workspace unavailable",
    board: "Other",
    city: "",
    subscription: {
      planName: "ScholarOS Annual School Access",
      status: "expired",
      startsAt: new Date().toISOString().slice(0, 10),
      endsAt: new Date().toISOString().slice(0, 10),
      seatLimit: 0,
      resourceAccess: "limited",
    },
  },
  students: [],
  resources: [],
};

export function useSchoolPlatform() {
  const { session, configured } = useAuth();
  const [state, setState] = useState<SchoolPlatformState>(defaultSchoolPlatformState);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"demo" | "cloud">("demo");
  const [manager, setManager] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCloud = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    const token = session?.access_token;
    if (!token) throw new Error("Cloud sign-in is required.");
    const response = await fetch("/api/school-platform/", {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Cloud request failed (${response.status}).`);
    return payload as CloudPayload;
  }, [session?.access_token]);

  const applyCloud = useCallback((payload: CloudPayload) => {
    setState(payload.state);
    setManager(payload.manager);
    setMode("cloud");
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!configured || !session?.access_token) {
      setState(loadSchoolPlatformState());
      setMode("demo");
      setManager(true);
      setError(null);
      setReady(true);
      return;
    }

    setSyncing(true);
    try {
      applyCloud(await requestCloud("GET"));
    } catch (cloudError) {
      // Fail closed for authenticated cloud accounts. Never show demo students as if
      // they belonged to a real school when the cloud request or mapping fails.
      setState(unavailableCloudState);
      setMode("cloud");
      setManager(false);
      setError(cloudError instanceof Error ? cloudError.message : "Cloud data is unavailable.");
    } finally {
      setSyncing(false);
      setReady(true);
    }
  }, [applyCloud, configured, requestCloud, session?.access_token]);

  useEffect(() => { void refresh(); }, [refresh]);

  function update(next: SchoolPlatformState | ((current: SchoolPlatformState) => SchoolPlatformState)) {
    setState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      if (mode === "demo") saveSchoolPlatformState(value);
      return value;
    });
  }

  const execute = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (mode !== "cloud") return null;
    if (!manager) throw new Error("School-manager permission is required.");
    setSyncing(true);
    try {
      const result = await requestCloud("POST", { action, ...payload });
      applyCloud(result);
      return result;
    } catch (cloudError) {
      const message = cloudError instanceof Error ? cloudError.message : "Cloud action failed.";
      setError(message);
      throw cloudError;
    } finally {
      setSyncing(false);
    }
  }, [applyCloud, manager, mode, requestCloud]);

  function reset() {
    if (mode === "demo") update(structuredClone(defaultSchoolPlatformState));
  }

  return { state, update, reset, ready, mode, manager, syncing, error, execute, refresh };
}
