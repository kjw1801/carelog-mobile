import { Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDbIfNeeded } from '@/db/migrations';
import { navigationTheme } from '@/theme/navigation';
import { ThemePreferenceProvider } from '@/theme/provider';
import { useThemeName } from '@/theme/useColors';

function Navigation() {
  const theme = useThemeName();

  return (
    <ThemeProvider value={navigationTheme(theme)}>
      {/* 상태바 아이콘 색. `auto`면 배경 밝기에 맞춰 뒤집힌다. */}
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feeding-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="diaper-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sleep-form" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="carelog.db" onInit={migrateDbIfNeeded}>
      <ThemePreferenceProvider>
        <Navigation />
      </ThemePreferenceProvider>
    </SQLiteProvider>
  );
}
