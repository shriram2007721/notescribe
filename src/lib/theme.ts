"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_KEY as KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";

const CHANGE_EVENT = "notescribe-theme-change";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const pref = readPreference();
    setPreference(pref);
    setIsDark(apply(pref));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPreference() === "system") setIsDark(apply("system"));
    };
    // Keep every component using this hook in sync when another one changes the theme.
    const onExternal = () => {
      const p = readPreference();
      setPreference(p);
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    mq.addEventListener("change", onChange);
    window.addEventListener(CHANGE_EVENT, onExternal);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener(CHANGE_EVENT, onExternal);
    };
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* storage blocked: the theme still applies for this session */
    }
    setPreference(pref);
    setIsDark(apply(pref));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { preference, isDark, setTheme, toggle: () => setTheme(isDark ? "light" : "dark") };
}
