
import { supabase } from "./supabase";

// ==================================================
// MIDLERTIDIG RLS-SIKKERHETSTEST
// ==================================================

// Venninnens testkonto.
// Fjern denne filen etter at testene er ferdige.
const OTHER_USER_ID =
  "e1c57a0a-ff8e-4c28-ab89-703f451a91c8";

export async function testDiaryIsolation(): Promise<boolean> {
  console.log("RLS-TEST: Starter kontroll.");

  try {
    // 1. Hent innlogget bruker.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log(
        "RLS-TEST: Avbrutt. Ingen gyldig innlogget bruker."
      );
      return false;
    }

    // 2. Unngå å teste brukeren mot seg selv.
    if (user.id === OTHER_USER_ID) {
      console.log(
        "RLS-TEST: Avbrutt. Testkontoen er innlogget."
      );
      return false;
    }

    // 3. Forsøk å hente bare rad-ID-er
    // fra den andre brukerens dagbok.
    const { data, error } = await supabase
      .from("diary_entries")
      .select("id")
      .eq("user_id", OTHER_USER_ID);

    if (error) {
      console.log(
        "RLS-TEST: Kunne ikke gjennomføres."
      );
      console.log("Feilkode:", error.code);
      console.log("Feilmelding:", error.message);
      return false;
    }

    // 4. Kontroller at ingen rader ble returnert.
    if ((data ?? []).length > 0) {
      console.log(
        "RLS-TEST FEILET: En annen brukers rader ble returnert."
      );
      return false;
    }

    console.log(
      "RLS-TEST BESTÅTT: Ingen rader fra den andre brukeren ble returnert."
    );

    return true;
  } catch {
    console.log(
      "RLS-TEST: En uventet feil oppstod."
    );

    return false;
  }
}
