import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { registerForPushNotificationsAsync } from '../lib/push';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  // ВАЖНО: Тут перечислены ВСЕ роли
  role: 'passenger' | 'driver' | 'admin' | 'venue' | null;
  isLoading: boolean;
  refreshRole: () => void; // Функция для исправления бага с ролью
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, isLoading: true, refreshRole: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'passenger' | 'driver' | 'admin' | 'venue' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Функция принудительного обновления роли
  const refreshRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
          await fetchRole(session.user.id);
      }
  };

  useEffect(() => {
    // 1. При запуске приложения
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
          console.log("🟢 [Auth] Сессия найдена:", session.user.id);
          fetchRole(session.user.id);
          registerForPushNotificationsAsync(session.user.id);
      } else {
          console.log("⚪ [Auth] Сессии нет");
          setIsLoading(false);
      }
    });

    // 2. При входе/выходе (слушатель событий)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
          console.log("🔄 [Auth] Изменение статуса:", _event);
          fetchRole(session.user.id);
      } else {
          setRole(null);
          setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    try {
      console.log("🔍 [Auth] Запрашиваем роль из БД...");
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (data) {
          console.log("✅ [Auth] Роль получена:", data.role);
          setRole(data.role as any);
      } else {
          console.log("⚠️ [Auth] Профиль не найден!");
      }
    } catch (e) {
      console.log("❌ [Auth] Ошибка роли:", e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, isLoading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}