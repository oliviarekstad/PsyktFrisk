
import "react-native-url-polyfill/auto";

import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// ==================================================
// 1. SUPABASE-INNSTILLINGER
// ==================================================

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase-innstillingene mangler i .env."
  );
}

// ==================================================
// 2. KONTROLLER HVOR APPEN KJØRER
// ==================================================

// SecureStore skal bare brukes på iOS og Android.
// Web og server-rendering må ikke kalle SecureStore.

const isNative =
  Platform.OS === "ios" || Platform.OS === "android";

// ==================================================
// 3. LAGRING AV INNLOGGINGSØKT
// ==================================================

// Vi bruker dynamisk import, slik at SecureStore
// ikke lastes inn på web eller under server-rendering.

const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!isNative) {
      return null;
    }

    const SecureStore = await import("expo-secure-store");

    return SecureStore.getItemAsync(key);
  },

  setItem: async (
    key: string,
    value: string
  ): Promise<void> => {
    if (!isNative) {
      return;
    }

    const SecureStore = await import("expo-secure-store");

    await SecureStore.setItemAsync(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (!isNative) {
      return;
    }

    const SecureStore = await import("expo-secure-store");

    await SecureStore.deleteItemAsync(key);
  },
};

// ==================================================
// 4. SUPABASE-KLIENT
// ==================================================

// På iPhone og Android lagres innloggingsøkten
// i SecureStore.
//
// På web/server lagres ingen økt med denne
// midlertidige løsningen.

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: nativeStorage,
      autoRefreshToken: isNative,
      persistSession: isNative,
      detectSessionInUrl: false,
    },
  }
);
