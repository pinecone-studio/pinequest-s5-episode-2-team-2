import { useState } from "react";
import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Screen, Text } from "../src/components/ui";
import { migrateDatabase } from "../src/storage/migrations";
import { fonts, theme } from "../src/theme";

// Pushed screens get a back button (#163). Each screen shows its own title, so the bar has none.
const stackHeader = {
  title: "",
  headerBackTitle: "Буцах",
  headerBackTitleStyle: { fontFamily: fonts.bold },
  headerTintColor: theme.colors.primary,
  headerStyle: { backgroundColor: theme.colors.background },
  headerShadowVisible: false,
};

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <Screen>
        <Text variant="title">Апп нээхэд алдаа гарлаа</Text>
        <Text>Хадгалсан мэдээллийг уншиж чадсангүй. Дахин оролдоно уу.</Text>
        <Button label="Дахин оролдох" onPress={retry} />
      </Screen>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  if (databaseError) throw databaseError;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider
        databaseName="pinequest.db"
        onInit={migrateDatabase}
        onError={setDatabaseError}
      >
        <Stack screenOptions={stackHeader}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
