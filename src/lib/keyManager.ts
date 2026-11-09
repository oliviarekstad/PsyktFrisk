
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  decodeKey,
  encodeKey,
  newKey,
} from "./encryption";

// ==================================================
// 1. KONTROLLER PLATTFORM
// ==================================================

function assertNative(): void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error(
      "Kryptert dagbok støttes foreløpig bare på iOS og Android."
    );
  }
}

// ==================================================
// 2. NØKKELNAVN PER BRUKER
// ==================================================

function keyName(userId: string): string {
  if (!userId || !userId.trim()) {
    throw new Error("Ugyldig bruker-ID.");
  }

  return `pf_diary_key_${userId.replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  )}`;
}

// ==================================================
// 3. SIKKER LAGRING
// ==================================================

async function saveKey(
  userId: string,
  encodedKey: string
): Promise<void> {
  assertNative();

  await SecureStore.setItemAsync(
    keyName(userId),
    encodedKey,
    {
      keychainAccessible:
        SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }
  );
}

// ==================================================
// 4. HENT EKSISTERENDE NØKKEL
// ==================================================

export async function getDiaryKey(
  userId: string
): Promise<Uint8Array | null> {
  assertNative();

  const stored = await SecureStore.getItemAsync(
    keyName(userId)
  );

  if (!stored) {
    return null;
  }

  return decodeKey(stored);
}

// ==================================================
// 5. OPPRETT NY NØKKEL
// ==================================================

export async function createDiaryKey(
  userId: string
): Promise<string> {
  assertNative();

  const existingKey = await getDiaryKey(userId);

  if (existingKey) {
    throw new Error(
      "Det finnes allerede en krypteringsnøkkel for denne brukeren."
    );
  }

  const key = await newKey();
  const recoveryCode = encodeKey(key);

  await saveKey(userId, recoveryCode);

  return recoveryCode;
}

// ==================================================
// 6. GJENOPPRETT NØKKEL
// ==================================================

export async function restoreDiaryKey(
  userId: string,
  recovery: string
): Promise<void> {
  assertNative();

  // Valider gjenopprettingskoden.
  const normalized = encodeKey(
    decodeKey(recovery)
  );

  // Kontroller om brukeren allerede har en nøkkel.
  const existingKey = await getDiaryKey(userId);

  if (existingKey) {
    const existingEncoded = encodeKey(existingKey);

    // Samme nøkkel er allerede lagret.
    // Ingen overskriving er nødvendig.
    if (existingEncoded === normalized) {
      return;
    }

    // En annen nøkkel må aldri erstatte den gamle
    // uten en egen, kontrollert nøkkelrotasjon.
    throw new Error(
      "Denne brukeren har allerede en annen krypteringsnøkkel. " +
      "Gjenoppretting er avbrutt for å beskytte eksisterende dagbokdata."
    );
  }

  // Ingen eksisterende nøkkel: lagre den gjenopprettede.
  await saveKey(userId, normalized);
}
