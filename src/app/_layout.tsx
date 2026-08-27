import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { migrateDbIfNeeded } from '@/db/migrations';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="carelog.db" onInit={migrateDbIfNeeded}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feeding-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="diaper-form" options={{ presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}
