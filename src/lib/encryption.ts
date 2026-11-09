
import { getRandomBytesAsync } from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { base64url } from "@scure/base";
import { utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils.js";

const PREFIX = "pf1.";

// ==================================================
// 1. KODING AV KRYPTERINGSNØKKEL
// ==================================================

// @scure/base bruker Base64URL med padding.
// En nøkkel på 32 bytes blir 44 tegn med "=" til slutt.
// Vi godtar også eldre koder på 43 tegn.

export function encodeKey(key: Uint8Array): string {
  if (key.length !== 32) {
    throw new Error("Ugyldig krypteringsnøkkel");
  }

  return base64url.encode(key);
}

// ==================================================
// 2. DEKODING AV KRYPTERINGSNØKKEL
// ==================================================

export function decodeKey(value: string): Uint8Array {
  // Fjern mellomrom, linjeskift og usynlige tegn.
  const cleaned = value.replace(
    /[\s\u200B-\u200D\uFEFF]/g,
    ""
  );

  // Godta 43 tegn eller 44 med avsluttende "=".
  if (!/^[A-Za-z0-9_-]{43}=?$/.test(cleaned)) {
    throw new Error(
      "Ugyldig nøkkelformat. Koden må ha 43 tegn, " +
      "eventuelt etterfulgt av =."
    );
  }

  // Legg til nødvendig padding uten å endre nøkkelen.
  const padded = cleaned.endsWith("=")
    ? cleaned
    : `${cleaned}=`;

  let key: Uint8Array;

  try {
    key = base64url.decode(padded);
  } catch {
    throw new Error(
      "Krypteringsnøkkelen kunne ikke dekodes."
    );
  }

  if (key.length !== 32) {
    throw new Error("Ugyldig krypteringsnøkkel");
  }

  // Kontroller at representasjonen er gyldig.
  // Selve nøkkelen logges aldri.
  if (base64url.encode(key) !== padded) {
    throw new Error("Ugyldig Base64URL-kode.");
  }

  return key;
}

// ==================================================
// 3. OPPRETT NY KRYPTERINGSNØKKEL
// ==================================================

export async function newKey(): Promise<Uint8Array> {
  return new Uint8Array(await getRandomBytesAsync(32));
}

// ==================================================
// 4. KRYPTER DAGBOKSKORT
// ==================================================

export async function encryptDiary(
  key: Uint8Array,
  userId: string,
  date: string,
  data: unknown
): Promise<string> {
  const nonce = new Uint8Array(
    await getRandomBytesAsync(12)
  );

  const aad = utf8ToBytes(
    `PsyktFrisk:diary:v1:${userId}:${date}`
  );

  const ciphertext = gcm(key, nonce, aad).encrypt(
    utf8ToBytes(JSON.stringify(data))
  );

  return (
    PREFIX +
    base64url.encode(nonce) +
    "." +
    base64url.encode(ciphertext)
  );
}

// ==================================================
// 5. DEKRYPTER DAGBOKSKORT
// ==================================================

export function decryptDiary<T>(
  key: Uint8Array,
  userId: string,
  date: string,
  encrypted: string
): T {
  const parts = encrypted.split(".");

  if (parts.length !== 3 || parts[0] !== "pf1") {
    throw new Error("Ukjent krypteringsformat");
  }

  const nonce = base64url.decode(parts[1]);

  if (nonce.length !== 12) {
    throw new Error("Ugyldig nonce");
  }

  const ciphertext = base64url.decode(parts[2]);

  const aad = utf8ToBytes(
    `PsyktFrisk:diary:v1:${userId}:${date}`
  );

  return JSON.parse(
    bytesToUtf8(
      gcm(key, nonce, aad).decrypt(ciphertext)
    )
  ) as T;
}
