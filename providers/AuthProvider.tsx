import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { registerForPushNotificationsAsync } from '../lib/push'; // <--- ВОТ ЭТОГО НЕ ХВАТАЛО
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: 'passenger' | 'driver' | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'passenger' | 'driver' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. При запуске
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
          console.log("🟢 Сессия найдена:", session.user.email);
          fetchRole(session.user.id);
          // Регистрируем пуши
          registerForPushNotificationsAsync(session.user.id);
      } else {
          console.log("⚪ Сессии нет");
          setIsLoading(false);
      }
    });

    // 2. При входе/выходе
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
          console.log("🔄 Вход выполнен:", session.user.email);
          fetchRole(session.user.id);
          // Регистрируем пуши
          registerForPushNotificationsAsync(session.user.id);
      } else {
          console.log("👋 Выход");
          setRole(null);
          setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    console.log("🔍 Ищем роль для ID:", userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
          console.error("❌ Ошибка получения роли:", error.message);
      } 
      
      if (data) {
          console.log("✅ Роль найдена:", data.role);
          setRole(data.role);
      } else {
          console.log("⚠️ Профиль не найден в базе!");
      }
    } catch (e) {
      console.log("❌ Критическая ошибка:", e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}