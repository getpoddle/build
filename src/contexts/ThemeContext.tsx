import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type AppTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: AppTheme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('theme-dark');
  } else {
    document.documentElement.classList.remove('theme-dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('poddle_theme') as AppTheme | null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme_preference && (data.theme_preference === 'dark' || data.theme_preference === 'light')) {
          const remote = data.theme_preference as AppTheme;
          setThemeState(remote);
          localStorage.setItem('poddle_theme', remote);
          applyTheme(remote);
        }
      });
  }, [user]);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('poddle_theme', newTheme);
    applyTheme(newTheme);
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
