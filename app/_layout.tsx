git statusimport { ThemeProvider, createTheme } from '@rneui/themed';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../providers/AuthProvider';

const theme = createTheme({
  lightColors: { primary: '#FFC107', secondary: '#242424', background: '#FFFFFF' },
  mode: 'light',
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Главная точка входа (проверка) */}
            <Stack.Screen name="index" />
            
            {/* Группы маршрутов */}
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(passenger)" />
            <Stack.Screen name="(driver)" />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}