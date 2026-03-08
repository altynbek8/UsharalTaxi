import { useAuth } from '@/providers/AuthProvider';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { session, role, isLoading } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Ждем, пока навигация и данные профиля загрузятся
    if (isLoading || !rootNavigationState?.key) return;

    if (!session) {
      router.replace('/(auth)/login');
    } else {
      if (role === 'passenger') {
        router.replace('/(passenger)/home');
      } else if (role === 'driver') {
        router.replace('/(driver)/home');
      } else {
        // Если роль еще не подтянулась или она странная
        router.replace('/(auth)/login');
      }
    }
  }, [session, role, isLoading, rootNavigationState]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <ActivityIndicator size="large" color="#FFC107" />
    </View>
  );
}