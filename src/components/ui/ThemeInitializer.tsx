'use client';

import { useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme-mode';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (mode: ThemeMode) => {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', mode);
  root.style.colorScheme = resolved;
};

export function ThemeInitializer() {
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'light';
    applyTheme(stored);

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media || !media.addEventListener) return;
    const handleChange = () => {
      const current = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (current === 'system') applyTheme('system');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return null;
}
