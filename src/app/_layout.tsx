import { Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { migrateDbIfNeeded } from '@/db/migrations';
import { navigationTheme } from '@/theme/navigation';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <SQLiteProvider databaseName="carelog.db" onInit={migrateDbIfNeeded}>
      <ThemeProvider value={navigationTheme(scheme)}>
        {/* 상태바 아이콘 색. `auto`면 배경 밝기에 맞춰 뒤집힌다. */}
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="feeding-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="diaper-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sleep-form" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
