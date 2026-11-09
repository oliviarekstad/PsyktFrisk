
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import { Stack, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import AuthScreen from "../components/AuthScreen";

export default function RootLayout() {
  const segments = useSegments();

  const [session, setSession] =
    useState<Session | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          if (!active) return;

          setSession(newSession);
          setLoading(false);
        }
      );

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          console.warn(
            "Kunne ikke hente innlogging:",
            error.message
          );
        }

        setSession(data.session);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;

        console.warn(
          "Feil ved kontroll av innlogging:",
          error
        );

        setLoading(false);
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const isPasswordResetRoute =
    segments[0] === "auth" &&
    segments[1] === "reset-password";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#456B60"
        />
      </View>
    );
  }

  if (!session && !isPasswordResetRoute) {
    return <AuthScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="diary" />
      <Stack.Screen name="development" />
      <Stack.Screen name="auth/reset-password" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F6F2",
  },
});
