"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  defaultSchoolPlatformState,
  loadSchoolPlatformState,
  saveSchoolPlatformState,
  type SchoolPlatformState,
} from "@/lib/schoolPlatform";

type CloudPayload = {
  mode: "cloud";
  manager: boolean;
  schoolStaff: boolean;
  rosterScope?: "organization" | "assigned_sections" | "own";
  state: SchoolPlatformState;
};
type SchoolPlatformOptions = { allowDemo?: boolean; unavailableMessage?: string };

class SchoolPlatformRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SchoolPlatformRequestError";
  }
}

const unavailableCloudState: SchoolPlatformState = {
  school: {
    id: "",
    name: "School workspace unavailable",
    board: "Other",
    city: "",
    subscription: {
      planName: "Founding Institution Plan",
      status: "expired",
      startsAt: new Date().toISOString().slice(0, 10),
      endsAt: new Date().toISOString().slice(0, 10),
      seatLimit: 0,
      resourceAccess: "limited",
    },
  },
  students: [],
  sections: [],
  resources: [],
};

export function useSchoolPlatform({
  allowDemo = true,
  unavailableMessage = "Supabase is not configured. Live student resources are unavailable.",
}: SchoolPlatformOptions = {}) {
  const {
    session,
    configured,
    loading: authLoading,
    activeOrganizationId,
    requiresInstitutionSelection,
  } = useAuth();
  const [state, setState] = useState<SchoolPlatformState>(
    allowDemo ? defaultSchoolPlatformState : unavailableCloudState,
  );
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"demo" | "cloud">("demo");
  const [manager, setManager] = useState(false);
  const [schoolStaff, setSchoolStaff] = useState(false);
  const [rosterScope, setRosterScope] = useState<"organization" | "assigned_sections" | "own">("own");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const requestCloud = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    const token = session?.access_token;
    if (!token) throw new Error("Cloud sign-in is required.");
    if (requiresInstitutionSelection) {
      throw new SchoolPlatformRequestError("Choose an active institution before opening school data.", 409);
    }
    const response = await fetch("/api/school-platform/", {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeOrganizationId ? { "X-Evidara-Organization-Id": activeOrganizationId } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new SchoolPlatformRequestError(
        payload.error || `Cloud request failed (${response.status}).`,
        response.status,
      );
    }
    return payload as CloudPayload;
  }, [activeOrganizationId, requiresInstitutionSelection, session?.access_token]);

  const applyCloud = useCallback((payload: CloudPayload) => {
    setState(payload.state);
    setManager(payload.manager);
    setSchoolStaff(payload.schoolStaff);
    setRosterScope(payload.rosterScope ?? "own");
    setMode("cloud");
    setError(null);
    setErrorStatus(null);
  }, []);

  const refresh = useCallback(async () => {
    if (authLoading) {
      setReady(false);
      return;
    }

    if ((!configured || !session?.access_token) && allowDemo) {
      setState(loadSchoolPlatformState());
      setMode("demo");
      setManager(true);
      setSchoolStaff(true);
      setRosterScope("organization");
      setError(null);
      setErrorStatus(null);
      setReady(true);
      return;
    }

    if (!configured || !session?.access_token) {
      setState(unavailableCloudState);
      setMode("cloud");
      setManager(false);
      setSchoolStaff(false);
      setRosterScope("own");
      setError(configured
        ? "Sign in to load resources authorized for your account."
        : unavailableMessage);
      setErrorStatus(configured ? 401 : 503);
      setReady(true);
      return;
    }

    if (requiresInstitutionSelection) {
      setState(unavailableCloudState);
      setMode("cloud");
      setManager(false);
      setSchoolStaff(false);
      setRosterScope("own");
      setError("Choose an active institution before opening school data.");
      setErrorStatus(409);
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
      setSchoolStaff(false);
      setRosterScope("own");
      setError(cloudError instanceof Error ? cloudError.message : "Cloud data is unavailable.");
      setErrorStatus(cloudError instanceof SchoolPlatformRequestError ? cloudError.status : 500);
    } finally {
      setSyncing(false);
      setReady(true);
    }
  }, [allowDemo, applyCloud, authLoading, configured, requestCloud, requiresInstitutionSelection, session?.access_token, unavailableMessage]);

  useEffect(() => { void refresh(); }, [refresh]);

  function update(next: SchoolPlatformState | ((current: SchoolPlatformState) => SchoolPlatformState)) {
    setState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      if (mode === "demo") saveSchoolPlatformState(value);
      return value;
    });
  }

  const command = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (mode !== "cloud") throw new Error("Cloud mode is required for this operation.");
    if (!manager) throw new Error("School-manager permission is required.");
    setSyncing(true);
    try {
      return await requestCloud("POST", { action, ...payload }) as unknown as Record<string, unknown>;
    } catch (cloudError) {
      const message = cloudError instanceof Error ? cloudError.message : "Cloud action failed.";
      setError(message);
      setErrorStatus(cloudError instanceof SchoolPlatformRequestError ? cloudError.status : 500);
      throw cloudError;
    } finally {
      setSyncing(false);
    }
  }, [manager, mode, requestCloud]);

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
      setErrorStatus(cloudError instanceof SchoolPlatformRequestError ? cloudError.status : 500);
      throw cloudError;
    } finally {
      setSyncing(false);
    }
  }, [applyCloud, manager, mode, requestCloud]);

  function reset() {
    if (mode === "demo") update(structuredClone(defaultSchoolPlatformState));
  }

  return {
    state,
    update,
    reset,
    ready,
    mode,
    manager,
    schoolStaff,
    rosterScope,
    syncing,
    error,
    errorStatus,
    execute,
    command,
    refresh,
  };
}
