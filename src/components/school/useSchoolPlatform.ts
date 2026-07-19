"use client";
import { useEffect, useState } from "react";
import { defaultSchoolPlatformState, loadSchoolPlatformState, saveSchoolPlatformState, SchoolPlatformState } from "@/lib/schoolPlatform";

export function useSchoolPlatform() {
  const [state, setState] = useState<SchoolPlatformState>(defaultSchoolPlatformState);
  const [ready, setReady] = useState(false);
  useEffect(() => { setState(loadSchoolPlatformState()); setReady(true); }, []);
  function update(next: SchoolPlatformState | ((current: SchoolPlatformState) => SchoolPlatformState)) {
    setState(current => {
      const value = typeof next === "function" ? next(current) : next;
      saveSchoolPlatformState(value);
      return value;
    });
  }
  function reset() { update(structuredClone(defaultSchoolPlatformState)); }
  return { state, update, reset, ready };
}
