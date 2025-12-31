import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

// ВАЖНО: export default function!
export default function Index() {
  const { session, role, isLoading } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Ждем, пока навигация полностью загрузится
    if (isLoading || !rootNavigationState?.key) return;

    if (!session) {
      // Если не вошел -> на Логин
      router.replace('/(auth)/login');
    } else {
      // Если вошел -> проверяем роль
      if (role === 'passenger') {
        router.replace('/(passenger)/home');
      } else if (role === 'driver') {
        router.replace('/(driver)/home');
      } else {
        // Если роли нет (странно), кидаем на логин
        router.replace('/(auth)/login');
      }
    }
  }, [session, role, isLoading, rootNavigationState]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#FFC107" />
    </View>
  );
}