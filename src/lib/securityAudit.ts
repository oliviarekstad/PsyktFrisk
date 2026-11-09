
import { getRandomBytesAsync } from "expo-crypto";
import { base64url } from "@scure/base";

import { supabase } from "./supabase";
import {
  newKey,
  encodeKey,
  decodeKey,
  encryptDiary,
  decryptDiary,
} from "./encryption";
import { getDiaryKey } from "./keyManager";

// ==================================================
// PSYKTFRISK - SAMLET SIKKERHETSTEST
//
// Bruk kun med testkontoer og testdata.
// Ingen eksisterende dagbokoppføringer endres.
// ==================================================

type TestResult = {
  name: string;
  passed: boolean;
  details?: string;
};

const results: TestResult[] = [];

function record(
  name: string,
  passed: boolean,
  details?: string
): void {
  results.push({ name, passed, details });

  console.log(
    `${passed ? "✅ BESTÅTT" : "❌ IKKE BESTÅTT"}: ${name}`
  );

  if (details) {
    console.log(`   ${details}`);
  }
}

async function expectFailure(
  action: () => unknown | Promise<unknown>
): Promise<boolean> {
  try {
    await action();
    return false;
  } catch {
    return true;
  }
}

function randomUuid(): Promise<string> {
  return getRandomBytesAsync(16).then((bytes) => {
    const b = new Uint8Array(bytes);

    // UUID versjon 4
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;

    const hex = Array.from(b, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  });
}

function changeCiphertext(value: string): string {
  const parts = value.split(".");

  if (parts.length !== 3) {
    throw new Error("Uventet krypteringsformat.");
  }

  const bytes = base64url.decode(parts[2]);

  if (bytes.length === 0) {
    throw new Error("Tom ciphertext.");
  }

  bytes[0] ^= 1;

  return `${parts[0]}.${parts[1]}.${base64url.encode(bytes)}`;
}

// ==================================================
// HOVEDTEST
// ==================================================

export async function runSecurityAudit(): Promise<void> {
  results.length = 0;

  console.log("");
  console.log("🔐 PSYKTFRISK SIKKERHETSTEST STARTER");
  console.log("====================================");

  // ----------------------------------------------
  // 1. KONTROLLER INNLOGGING
  // ----------------------------------------------

  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    record("Innlogging", false);
    console.log("Testen avbrytes.");
    return;
  }

  const userId = auth.user.id;

  record("Innlogging", true);

  // ----------------------------------------------
  // 2. KRYPTERING
  // ----------------------------------------------

  const key = await newKey();
  const wrongKey = await newKey();

  const testDate = "2026-01-15";

  const testData = {
    lifeAnswers: {
      Selvskading: false,
    },
    emotionLevels: {
      Stress: 4,
    },
    behaviorAnswers: {},
    screenTime: "2",
    skillAnswers: {},
    skillDetails: {},
    dailyNote: "UFARLIGE TESTDATA",
  };

  const encrypted = await encryptDiary(
    key,
    userId,
    testDate,
    testData
  );

  const decrypted = decryptDiary<typeof testData>(
    key,
    userId,
    testDate,
    encrypted
  );

  record(
    "Kryptering og dekryptering",
    JSON.stringify(decrypted) === JSON.stringify(testData)
  );

  record(
    "Feil nøkkel avvises",
    await expectFailure(() =>
      decryptDiary(
        wrongKey,
        userId,
        testDate,
        encrypted
      )
    )
  );

  record(
    "Manipulert ciphertext avvises",
    await expectFailure(() =>
      decryptDiary(
        key,
        userId,
        testDate,
        changeCiphertext(encrypted)
      )
    )
  );

  record(
    "Feil dato avvises",
    await expectFailure(() =>
      decryptDiary(
        key,
        userId,
        "2026-01-16",
        encrypted
      )
    )
  );

  record(
    "Feil bruker-ID avvises",
    await expectFailure(async () =>
      decryptDiary(
        key,
        await randomUuid(),
        testDate,
        encrypted
      )
    )
  );

  // ----------------------------------------------
  // 3. NØKKELFORMAT
  // ----------------------------------------------

  const encoded = encodeKey(key);
  const decoded = decodeKey(encoded);

  record(
    "Nøkkel kan kodes og dekodes",
    encodeKey(decoded) === encoded
  );

  record(
    "Ugyldig gjenopprettingskode avvises",
    await expectFailure(() =>
      decodeKey("ugyldig-gjenopprettingskode")
    )
  );

  // ----------------------------------------------
  // 4. LOKAL NØKKELLAGRING
  // ----------------------------------------------

  try {
    const existingKey = await getDiaryKey(userId);

    record(
      "SecureStore kan leses",
      existingKey === null ||
        existingKey.length === 32
    );
  } catch {
    record("SecureStore kan leses", false);
  }

  // ----------------------------------------------
  // 5. SUPABASE RLS - LESING
  // ----------------------------------------------

  const { error: ownReadError } = await supabase
    .from("diary_entries")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  record(
    "Egen bruker kan forespørre dagbok",
    !ownReadError
  );

  // En tilfeldig fremmed bruker-ID.
  // Null rader alene er ikke bevis på RLS.
  const foreignUserId = await randomUuid();

  const { data: foreignRows, error: foreignReadError } =
    await supabase
      .from("diary_entries")
      .select("id")
      .eq("user_id", foreignUserId);

  record(
    "Forespørsel etter fremmed bruker returnerer ingen rader",
    !foreignReadError &&
      Array.isArray(foreignRows) &&
      foreignRows.length === 0,
    "Dette er kun en kontroll, ikke et fullstendig bevis på RLS."
  );

  // ----------------------------------------------
  // 6. RLS - FORSØK PÅ UAUTORISERT INSERT
  // ----------------------------------------------

  // Bruk en tilfeldig UUID som ikke tilhører
  // den innloggede brukeren.
  //
  // RLS skal avvise INSERT fordi user_id
  // ikke er lik auth.uid().
  //
  // En foreign key kan også avvise denne raden.
  // Derfor rapporteres utfallet som en
  // avvisningskontroll, ikke et isolert RLS-bevis.

  const foreignEntryId = await randomUuid();

  const { error: foreignInsertError } = await supabase
    .from("diary_entries")
    .insert({
      id: foreignEntryId,
      user_id: foreignUserId,
      entry_date: "2099-01-01",
      ciphertext: encrypted,
    });

  record(
    "Uautorisert INSERT avvises",
    foreignInsertError !== null,
    foreignInsertError
      ? `Avvist med databasekode: ${foreignInsertError.code}`
      : "ADVARSEL: Databasen godtok innsettingen."
  );

  // Dersom en feilkonfigurert database faktisk
  // godtok raden, forsøker vi å rydde den opp.
  // Sletting kan også blokkeres av RLS.
  if (!foreignInsertError) {
    const { error: cleanupError } = await supabase
      .from("diary_entries")
      .delete()
      .eq("id", foreignEntryId);

    record(
      "Opprydding etter uventet INSERT",
      !cleanupError,
      "Kontroller manuelt i Supabase at test-ID-en er borte."
    );
  }

  // ----------------------------------------------
  // 7. RAPPORT
  // ----------------------------------------------

  console.log("");
  console.log("====================================");
  console.log("🔐 PSYKTFRISK SIKKERHETSRAPPORT");
  console.log("====================================");

  const passed = results.filter(
    (result) => result.passed
  ).length;

  const failed = results.length - passed;

  console.log(`Bestått: ${passed}`);
  console.log(`Ikke bestått: ${failed}`);
  console.log(`Totalt: ${results.length}`);

  if (failed === 0) {
    console.log(
      "✅ Alle automatiserte kontroller i denne testfilen bestod."
    );
  } else {
    console.log(
      "❌ En eller flere kontroller må undersøkes."
    );
  }

  console.log(
    "MERK: Dette er ikke en fullstendig sikkerhetsrevisjon."
  );

  console.log("🔐 Sikkerhetstest fullført.");
}
