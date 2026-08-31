import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const themeStorageKey = 'monad-design-theme';

const initialTheme = (): ThemePreference => {
  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
  return 'system';
};

export function useClientTheme() {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolvedTheme = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themePreference = theme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    window.localStorage.setItem(themeStorageKey, theme);
    if (theme !== 'system') return;

    systemTheme.addEventListener('change', applyTheme);
    return () => systemTheme.removeEventListener('change', applyTheme);
  }, [theme]);

  return { setTheme, theme };
}
