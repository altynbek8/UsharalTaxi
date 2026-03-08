import { registerForPushNotificationsAsync } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: 'passenger' | 'driver' | 'admin' | null;
  isLoading: boolean;
  refreshRole: () => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isLoading: true,
  refreshRole: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'passenger' | 'driver' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (data) {
        setRole(data.role as any);
      }
    } catch (e) {
      console.log("❌ [Auth] Ошибка роли:", e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // 1. Проверка сессии при запуске
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
        registerForPushNotificationsAsync(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Слушатель изменений авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshRole = () => {
    if (session?.user) fetchRole(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, isLoading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}