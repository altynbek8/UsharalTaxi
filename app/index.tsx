import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

export default function Index() {
  const { session, role, isLoading } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading || !rootNavigationState?.key) return;

    if (!session) {
      router.replace('/(auth)/login');
    } else {
      // ПРОВЕРКА РОЛЕЙ
      if (role === 'passenger') {
        router.replace('/(passenger)/home');
      } else if (role === 'driver') {
        router.replace('/(driver)/home');
      } else if (role === 'admin') {
        router.replace('/(admin)/dashboard'); // Переход в админку
      } else {
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