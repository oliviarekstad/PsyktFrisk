
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { supabase } from "../lib/supabase";
import {
  encryptDiary,
  decryptDiary,
  decodeKey,
} from "../lib/encryption";
import {
  createDiaryKey,
  getDiaryKey,
  restoreDiaryKey,
} from "../lib/keyManager";

// ==================================================
// 1. DATOHJELPERE
// ==================================================

function localDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateId: string): Date {
  const [year, month, day] = dateId.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function shiftDate(dateId: string, offset: number): string {
  const date = parseLocalDate(dateId);
  date.setDate(date.getDate() + offset);
  return localDateId(date);
}

// ==================================================
// 2. FARGER OG DESIGN
// ==================================================

const COLORS = {
  background: "#F8F6F2",
  primary: "#456B60",
  darkGreen: "#34594D",
  bodyText: "#40584F",
  mutedText: "#77766F",
  white: "#FFFFFF",

  lifeBackground: "#FBE9ED",
  lifeAccent: "#A85C72",

  emotionBackground: "#E6F2E8",

  behaviorBackground: "#FCE4E2",
  behaviorAccent: "#A95858",

  notesBackground: "#F0E8FA",
  notesAccent: "#79559A",
};

// ==================================================
// 3. INNHOLD I DAGBOKSKORTET
// ==================================================

const lifeThreatening = [
  "Selvmordstanker",
  "Selvskading",
  "Rus",
];

const emotions = [
  "Trist / lei deg",
  "Engstelig / redd",
  "Irritert / sint",
  "Glad",
  "Stress",
];

const interferingBehaviors = [
  "Grubling / bekymringstanker",
  "Angst",
  "Unngåelsesatferd",
  "Rus",
  "Skadelige relasjoner",
  "Opplevd avvisning",
  "Sort / hvitt tankegang",
  "Skjermtid",
];

const skillGroups = [
  {
    name: "Mindfulness",
    background: "#E5F0FB",
    accent: "#3D658D",
  },
  {
    name: "Holde ut-ferdigheter",
    background: "#E5F0FB",
    accent: "#3D658D",
  },
  {
    name: "Relasjonsferdigheter",
    background: "#F0E8FA",
    accent: "#79559A",
  },
  {
    name: "Følelsesferdigheter",
    background: "#FBE6E6",
    accent: "#A55258",
  },
];

// ==================================================
// 4. TYPER
// ==================================================

type DiaryEntry = {
  lifeAnswers: Record<string, boolean>;
  emotionLevels: Record<string, number>;
  behaviorAnswers: Record<string, boolean>;
  screenTime: string;
  skillAnswers: Record<string, boolean>;
  skillDetails: Record<string, string>;
  dailyNote: string;
};

const EMPTY_ENTRY: DiaryEntry = {
  lifeAnswers: {},
  emotionLevels: {},
  behaviorAnswers: {},
  screenTime: "",
  skillAnswers: {},
  skillDetails: {},
  dailyNote: "",
};

// ==================================================
// 5. HOVEDKOMPONENT
// ==================================================

export default function DiaryScreen() {
  const router = useRouter();

  // ----------------------------------------------
  // 5A. DAGBOKSDATA
  // ----------------------------------------------

  const [lifeAnswers, setLifeAnswers] = useState<
    Record<string, boolean>
  >({});

  const [emotionLevels, setEmotionLevels] = useState<
    Record<string, number>
  >({});

  const [behaviorAnswers, setBehaviorAnswers] = useState<
    Record<string, boolean>
  >({});

  const [screenTime, setScreenTime] = useState("");

  const [skillAnswers, setSkillAnswers] = useState<
    Record<string, boolean>
  >({});

  const [skillDetails, setSkillDetails] = useState<
    Record<string, string>
  >({});

  const [dailyNote, setDailyNote] = useState("");

  // ----------------------------------------------
  // 5B. INNLOGGING OG KRYPTERING
  // ----------------------------------------------

  const [userId, setUserId] = useState<string | null>(null);

  const [diaryKeyReady, setDiaryKeyReady] = useState(false);

  const [hasExistingData, setHasExistingData] = useState(false);

  const [recoveryCode, setRecoveryCode] = useState<
    string | null
  >(null);

  const [recoveryInput, setRecoveryInput] = useState("");

  const [recoveryConfirmed, setRecoveryConfirmed] =
    useState(false);

  // ----------------------------------------------
  // 5C. STATUS
  // ----------------------------------------------

  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState<
    string | null
  >(null);

  const [hasEntry, setHasEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] =
    useState(false);

  // ----------------------------------------------
  // 5D. VALGT DATO
  // ----------------------------------------------

  const [dateId, setDateId] = useState(() =>
    localDateId(new Date())
  );

  const requestId = useRef(0);
  const saveLock = useRef(false);
  const originalCiphertext = useRef<string | null>(null);

  const todayId = localDateId(new Date());
  const isToday = dateId === todayId;
  const canGoForward = dateId < todayId;

  const selectedDateLabel = parseLocalDate(
    dateId
  ).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ==================================================
  // 6. HJELPEFUNKSJONER
  // ==================================================

  function applyEntry(entry: DiaryEntry) {
    setLifeAnswers(entry.lifeAnswers ?? {});
    setEmotionLevels(entry.emotionLevels ?? {});
    setBehaviorAnswers(entry.behaviorAnswers ?? {});
    setScreenTime(entry.screenTime ?? "");
    setSkillAnswers(entry.skillAnswers ?? {});
    setSkillDetails(entry.skillDetails ?? {});
    setDailyNote(entry.dailyNote ?? "");
    setHasUnsavedChanges(false);
  }

  function clearForm() {
    applyEntry(EMPTY_ENTRY);
  }

  function markChanged() {
    setHasUnsavedChanges(true);
  }

  // ==================================================
  // 7. BESKYTTELSE MOT ULAGREDE ENDRINGER
  // ==================================================

  function confirmDiscard(onConfirm: () => void) {
    if (!hasUnsavedChanges) {
      onConfirm();
      return;
    }

    Alert.alert(
      "Ulagrede endringer",
      "Du har endringer som ikke er lagret. Hvis du fortsetter, går disse endringene tapt.",
      [
        {
          text: "Fortsett å redigere",
          style: "cancel",
        },
        {
          text: "Forkast endringer",
          style: "destructive",
          onPress: onConfirm,
        },
      ]
    );
  }

  function goBackSafely() {
    if (busy || saving) return;

    confirmDiscard(() => {
      router.replace("/");
    });
  }

  // ==================================================
  // 8. HENT STATUS FOR EN DATO
  // ==================================================

  async function loadDate(
    uid: string,
    targetDate: string
  ) {
    const currentRequest = ++requestId.current;

    setBusy(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("diary_entries")
        .select("entry_date")
        .eq("user_id", uid)
        .eq("entry_date", targetDate)
        .maybeSingle();

      if (error) throw error;

      if (currentRequest !== requestId.current) return;

      setDateId(targetDate);
      setHasEntry(!!data);
      setEditingEntry(false);
      originalCiphertext.current = null;
      clearForm();
    } catch {
      if (currentRequest !== requestId.current) return;

      setLoadError(
        "Kunne ikke åpne datoen. Kontroller tilkoblingen og prøv igjen."
      );

      Alert.alert(
        "Kunne ikke åpne datoen",
        "Kontroller tilkoblingen og prøv igjen."
      );
    } finally {
      if (currentRequest === requestId.current) {
        setBusy(false);
      }
    }
  }

  // ==================================================
  // 9. BLA MELLOM DATOER
  // ==================================================

  function goToDate(offset: number) {
    if (
      !userId ||
      busy ||
      saving ||
      recoveryCode ||
      !diaryKeyReady
    ) {
      return;
    }

    const nextDate = shiftDate(dateId, offset);

    if (nextDate > localDateId(new Date())) return;

    confirmDiscard(() => {
      void loadDate(userId, nextDate);
    });
  }

  // ==================================================
  // 10. ÅPNE EKSISTERENDE DAGBOKSKORT
  // ==================================================

  async function editExistingEntry() {
    if (!userId || busy || saving) return;

    const currentRequest = ++requestId.current;

    setBusy(true);

    try {
      const key = await getDiaryKey(userId);

      if (!key) {
        throw new Error("Krypteringsnøkkelen mangler.");
      }

      const { data, error } = await supabase
        .from("diary_entries")
        .select("ciphertext")
        .eq("user_id", userId)
        .eq("entry_date", dateId)
        .maybeSingle();

      if (error) throw error;

      if (currentRequest !== requestId.current) return;

      if (!data) {
        setHasEntry(false);
        setEditingEntry(false);
        originalCiphertext.current = null;
        clearForm();
        return;
      }

      const entry = decryptDiary<DiaryEntry>(
        key,
        userId,
        dateId,
        data.ciphertext
      );

      if (currentRequest !== requestId.current) return;

      originalCiphertext.current = data.ciphertext;

      applyEntry(entry);
      setEditingEntry(true);
      setLoadError(null);
    } catch {
      if (currentRequest !== requestId.current) return;

      Alert.alert(
        "Kunne ikke åpne registreringen",
        "Kontroller krypteringsnøkkelen og prøv igjen."
      );
    } finally {
      if (currentRequest === requestId.current) {
        setBusy(false);
      }
    }
  }

  // ==================================================
  // 11. LAST INN BRUKER OG DAGBOK
  // ==================================================

  useEffect(() => {
    let alive = true;

    async function initialize() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          throw new Error("Du må være innlogget.");
        }

        if (!alive) return;

        setUserId(user.id);

        const { count, error: countError } =
          await supabase
            .from("diary_entries")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", user.id);

        if (countError) throw countError;
        if (!alive) return;

        setHasExistingData((count ?? 0) > 0);

        // Les lokal nøkkel.
        // Feil ved dekoding må ikke stoppe
        // resten av dagbokskjermen.

        let key: Uint8Array | null = null;

        try {
          key = await getDiaryKey(user.id);
        } catch {
          // Behold den lagrede nøkkelen urørt.
          // Vis gjenopprettingsskjermen i stedet.
          key = null;
        }

        if (!alive) return;

        setDiaryKeyReady(!!key);

        const initialDate = localDateId(new Date());

        const { data, error: dateError } =
          await supabase
            .from("diary_entries")
            .select("entry_date")
            .eq("user_id", user.id)
            .eq("entry_date", initialDate)
            .maybeSingle();

        if (dateError) throw dateError;
        if (!alive) return;

        setDateId(initialDate);
        setHasEntry(!!data);
        setEditingEntry(false);
        originalCiphertext.current = null;
        clearForm();
      } catch (error) {
        if (!alive) return;

        const message =
          error instanceof Error
            ? error.message
            : "Ukjent feil.";

        setLoadError(
          "Kunne ikke åpne dagboken: " + message
        );
      } finally {
        if (alive) {
          setBusy(false);
        }
      }
    }

    void initialize();

    return () => {
      alive = false;
      requestId.current += 1;
    };
  }, []);

  // ==================================================
  // 12. OPPRETT KRYPTERINGSNØKKEL
  // ==================================================

  async function setupKey() {
    if (!userId || hasExistingData || busy) return;

    setBusy(true);

    try {
      const { count, error } = await supabase
        .from("diary_entries")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId);

      if (error) throw error;

      if ((count ?? 0) > 0) {
        setHasExistingData(true);

        throw new Error(
          "Det finnes allerede dagbokdata. Bruk gjenopprettingskoden."
        );
      }

      const code = await createDiaryKey(userId);

      setRecoveryCode(code);
      setRecoveryConfirmed(false);
      setDiaryKeyReady(true);
      setLoadError(null);
    } catch (error) {
      Alert.alert(
        "Kunne ikke opprette nøkkel",
        error instanceof Error
          ? error.message
          : "Prøv igjen."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // 13. GJENOPPRETT KRYPTERINGSNØKKEL
  // ==================================================

  async function recoverKey() {
    if (!userId || busy || !recoveryInput.trim()) return;

    setBusy(true);

    try {
      // Godta både 43 tegn og 44 tegn med "=".
      const normalized = recoveryInput.replace(
        /[\s\u200B-\u200D\uFEFF]/g,
        ""
      );

      if (!/^[A-Za-z0-9_-]{43}=?$/.test(normalized)) {
        throw new Error(
          `Koden har ${normalized.length} tegn etter at mellomrom er fjernet. ` +
          "En PsyktFrisk-gjenopprettingskode skal ha 43 tegn, " +
          "eventuelt 44 tegn med = til slutt."
        );
      }

      let candidate: Uint8Array;

      try {
        candidate = decodeKey(normalized);
      } catch {
        throw new Error(
          "Koden kunne ikke dekodes. Kontroller tegnene mot originalen."
        );
      }

      const {
        data: auth,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || auth.user?.id !== userId) {
        throw new Error(
          "Innloggingen har endret seg. Logg inn på nytt."
        );
      }

      // Kontroller eksisterende lokal nøkkel.
      // Ikke overskriv en annen nøkkel.

      const existingKey = await getDiaryKey(userId);

      if (
        existingKey &&
        !existingKey.every(
          (value, index) => value === candidate[index]
        )
      ) {
        throw new Error(
          "Denne telefonen har allerede en annen krypteringsnøkkel. " +
          "Ingen nøkler er endret."
        );
      }

      // Kontroller alle dagbokoppføringer
      // før gjenopprettingsnøkkelen lagres.

      let checked = 0;
      let offset = 0;
      const pageSize = 100;

      while (true) {
        const { data, error } = await supabase
          .from("diary_entries")
          .select("entry_date,ciphertext")
          .eq("user_id", userId)
          .order("entry_date", {
            ascending: true,
          })
          .range(
            offset,
            offset + pageSize - 1
          );

        if (error) {
          throw new Error(
            "Kunne ikke hente dagbokdata: " +
            error.message
          );
        }

        const batch = data ?? [];

        for (const entry of batch) {
          try {
            decryptDiary<DiaryEntry>(
              candidate,
              userId,
              entry.entry_date,
              entry.ciphertext
            );
          } catch {
            throw new Error(
              checked === 0
                ? "Koden har gyldig format, men dekrypterer ikke " +
                    "den første dagbokoppføringen. Det kan være feil nøkkel " +
                    "eller et problem med de lagrede dataene."
                : "Koden dekrypterer noen oppføringer, men ikke alle. " +
                    "Ingen data eller nøkler er endret."
            );
          }

          checked += 1;
        }

        if (batch.length < pageSize) break;

        offset += pageSize;
      }

      if (checked === 0) {
        throw new Error(
          "Fant ingen dagbokoppføringer å kontrollere mot. " +
          "Ingen nøkkel er lagret."
        );
      }

      await restoreDiaryKey(userId, normalized);

      setDiaryKeyReady(true);
      setRecoveryInput("");
      setLoadError(null);

      await loadDate(userId, dateId);

      Alert.alert(
        "Nøkkel gjenopprettet 💚",
        `Koden ble kontrollert mot ${checked} dagbokoppføringer.`
      );
    } catch (error) {
      Alert.alert(
        "Kunne ikke gjenopprette",
        error instanceof Error
          ? error.message
          : "Ukjent feil."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // 14. AVKRYSNINGSBOKSER
  // ==================================================

  function renderCheckbox(
    item: string,
    answers: Record<string, boolean>,
    setAnswers: React.Dispatch<
      React.SetStateAction<Record<string, boolean>>
    >,
    accent: string
  ) {
    const selected = answers[item] === true;

    return (
      <Pressable
        key={item}
        style={styles.checkboxRow}
        onPress={() => {
          setAnswers((previous) => ({
            ...previous,
            [item]: !previous[item],
          }));

          markChanged();
        }}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: accent },
            selected && {
              backgroundColor: accent,
            },
          ]}
        >
          {selected && (
            <Text style={styles.checkmark}>
              ✓
            </Text>
          )}
        </View>

        <Text style={styles.itemText}>
          {item}
        </Text>
      </Pressable>
    );
  }

  // ==================================================
  // 15. LAGRE DAGBOKSKORT
  // ==================================================

  async function handleSave() {
    if (
      !userId ||
      !diaryKeyReady ||
      busy ||
      saving ||
      saveLock.current ||
      recoveryCode ||
      (hasEntry && !editingEntry)
    ) {
      return;
    }

    if (dateId > localDateId(new Date())) {
      Alert.alert(
        "Ugyldig dato",
        "Du kan ikke fylle ut fremtidige dagbokskort."
      );
      return;
    }

    saveLock.current = true;
    setSaving(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        authData.user?.id !== userId
      ) {
        throw new Error(
          "Innloggingen har endret seg. Logg inn på nytt."
        );
      }

      const key = await getDiaryKey(userId);

      if (!key) {
        throw new Error(
          "Krypteringsnøkkelen mangler."
        );
      }

      const entry: DiaryEntry = {
        lifeAnswers,
        emotionLevels,
        behaviorAnswers,
        screenTime,
        skillAnswers,
        skillDetails,
        dailyNote,
      };

      const ciphertext = await encryptDiary(
        key,
        userId,
        dateId,
        entry
      );

      if (editingEntry) {
        if (!originalCiphertext.current) {
          throw new Error(
            "Åpne dagbokskortet på nytt før lagring."
          );
        }

        const { data: updated, error } =
          await supabase
            .from("diary_entries")
            .update({ ciphertext })
            .eq("user_id", userId)
            .eq("entry_date", dateId)
            .eq(
              "ciphertext",
              originalCiphertext.current
            )
            .select("entry_date");

        if (error) throw error;

        if (updated?.length !== 1) {
          throw new Error(
            "Dagbokskortet er endret eller slettet på en annen enhet. " +
            "Endringene dine er ikke overskrevet. " +
            "Ta vare på notatene før du åpner kortet på nytt."
          );
        }
      } else {
        const { error } = await supabase
          .from("diary_entries")
          .insert({
            user_id: userId,
            entry_date: dateId,
            ciphertext,
          });

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "Det finnes allerede et dagbokskort for denne datoen. " +
              "Åpne datoen på nytt for å redigere."
            );
          }

          throw error;
        }
      }

      originalCiphertext.current = null;

      setHasEntry(true);
      setEditingEntry(false);
      setHasExistingData(true);
      clearForm();

      Alert.alert(
        "Dagbokskort lagret 💚",
        `Registreringen for ${selectedDateLabel} er kryptert og lagret.`
      );
    } catch (error) {
      Alert.alert(
        "Kunne ikke lagre",
        error instanceof Error
          ? error.message
          : "Prøv igjen."
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  // ==================================================
  // 16. AVBRYT REDIGERING
  // ==================================================

  function cancelEditing() {
    confirmDiscard(() => {
      clearForm();
      setEditingEntry(false);
      originalCiphertext.current = null;
    });
  }

  // ==================================================
  // 17. BRUKERGRENSESNITT
  // ==================================================

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ==========================================
            TILBAKEKNAPP
        ========================================== */}

        <Pressable
          style={styles.backButton}
          onPress={goBackSafely}
          disabled={busy || saving}
        >
          <Text style={styles.backButtonText}>
            ← Tilbake
          </Text>
        </Pressable>

        {/* ==========================================
            OVERSKRIFT
        ========================================== */}

        <Text style={styles.title}>
          📔 Dagbokskort
        </Text>

        {/* ==========================================
            DATONAVIGASJON
        ========================================== */}

        <View style={styles.dateNavigation}>
          <Pressable
            style={styles.dateArrow}
            onPress={() => goToDate(-1)}
            disabled={
              busy ||
              saving ||
              !diaryKeyReady
            }
          >
            <Text style={styles.dateArrowText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.dateCenter}>
            <Text style={styles.dateText}>
              {selectedDateLabel}
            </Text>

            <Text style={styles.dateHint}>
              {isToday
                ? "I dag"
                : "Tidligere dagbokskort"}
            </Text>
          </View>

          <Pressable
            style={[
              styles.dateArrow,
              !canGoForward &&
                styles.dateArrowDisabled,
            ]}
            onPress={() => goToDate(1)}
            disabled={
              !canGoForward ||
              busy ||
              saving ||
              !diaryKeyReady
            }
          >
            <Text style={styles.dateArrowText}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text style={styles.subtitle}>
          Et lite øyeblikk for å kjenne etter.
        </Text>

        {/* ==========================================
            LASTESTATUS
        ========================================== */}

        {busy && (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />
        )}

        {loadError && (
          <Text style={styles.errorText}>
            {loadError}
          </Text>
        )}

        {/* ==========================================
            KRYPTERINGSNØKKEL
        ========================================== */}

        {!busy &&
          !loadError &&
          !diaryKeyReady && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    COLORS.emotionBackground,
                },
              ]}
            >
              <Text style={styles.cardTitle}>
                🔐 Beskytt dagboken din
              </Text>

              <Text style={styles.description}>
                {hasExistingData
                  ? "Dagboken er allerede kryptert. Oppgi gjenopprettingskoden fra den gamle telefonen."
                  : "Opprett en personlig krypteringsnøkkel før du lagrer første registrering."}
              </Text>

              {!hasExistingData && (
                <Pressable
                  style={styles.saveButton}
                  onPress={setupKey}
                >
                  <Text
                    style={styles.saveButtonText}
                  >
                    Opprett krypteringsnøkkel
                  </Text>
                </Pressable>
              )}

              {hasExistingData && (
                <>
                  <TextInput
                    style={[
                      styles.notesInput,
                      {
                        minHeight: 54,
                        marginTop: 12,
                      },
                    ]}
                    placeholder="Gjenopprettingskode"
                    placeholderTextColor="#85837C"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    value={recoveryInput}
                    onChangeText={setRecoveryInput}
                  />

                  <Pressable
                    style={[
                      styles.saveButton,
                      { marginTop: 12 },
                    ]}
                    onPress={recoverKey}
                    disabled={
                      !recoveryInput.trim()
                    }
                  >
                    <Text
                      style={styles.saveButtonText}
                    >
                      Gjenopprett nøkkel
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

        {/* ==========================================
            VIS GJENOPPRETTINGSKODE
        ========================================== */}

        {recoveryCode && (
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  COLORS.lifeBackground,
              },
            ]}
          >
            <Text style={styles.cardTitle}>
              Viktig: Ta vare på gjenopprettingskoden
            </Text>

            <Text style={styles.description}>
              Skriv koden ned og oppbevar den
              sikkert utenfor telefonen.
              Uten den kan dagboken gå tapt
              hvis telefonen byttes eller
              slettes. Ikke del koden.
            </Text>

            <Text
              selectable
              style={styles.recoveryCode}
            >
              {recoveryCode}
            </Text>

            <Pressable
              style={styles.checkboxRow}
              onPress={() =>
                setRecoveryConfirmed(
                  (previous) => !previous
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor:
                      COLORS.lifeAccent,
                  },
                  recoveryConfirmed && {
                    backgroundColor:
                      COLORS.lifeAccent,
                  },
                ]}
              >
                {recoveryConfirmed && (
                  <Text style={styles.checkmark}>
                    ✓
                  </Text>
                )}
              </View>

              <Text style={styles.itemText}>
                Jeg har lagret koden på et
                sikkert sted.
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveButton,
                !recoveryConfirmed &&
                  styles.disabledButton,
              ]}
              disabled={!recoveryConfirmed}
              onPress={() => {
                setRecoveryCode(null);
                setRecoveryConfirmed(false);
              }}
            >
              <Text
                style={styles.saveButtonText}
              >
                Fortsett til dagboken
              </Text>
            </Pressable>
          </View>
        )}

        {/* ==========================================
            EKSISTERENDE DAGBOKSKORT
        ========================================== */}

        {!busy &&
          diaryKeyReady &&
          !recoveryCode &&
          !loadError &&
          hasEntry &&
          !editingEntry && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    COLORS.emotionBackground,
                },
              ]}
            >
              <Text style={styles.cardTitle}>
                💚 Dagbokskortet er allerede fylt ut
              </Text>

              <Text style={styles.description}>
                Du har allerede registrert et
                dagbokskort for denne datoen.
                Ønsker du å åpne og endre det?
              </Text>

              <Pressable
                style={styles.saveButton}
                onPress={editExistingEntry}
              >
                <Text
                  style={styles.saveButtonText}
                >
                  Åpne og rediger dagbokskort
                </Text>
              </Pressable>

              <Text
                style={[
                  styles.description,
                  { marginTop: 12 },
                ]}
              >
                Du kan også bruke pilene over
                for å gå til en annen dato.
              </Text>
            </View>
          )}

        {/* ==========================================
            DAGBOKSKJEMA
        ========================================== */}

        {!busy &&
          diaryKeyReady &&
          !recoveryCode &&
          !loadError &&
          (!hasEntry || editingEntry) && (
            <>
              {/* ================================
                  POTENSIELT LIVSTRUENDE ATFERD
              ================================= */}

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      COLORS.lifeBackground,
                  },
                ]}
              >
                <Text style={styles.cardTitle}>
                  Potensielt livstruende atferd
                </Text>

                <Text style={styles.description}>
                  Huk av dersom noe av dette
                  har vært aktuelt denne dagen.
                </Text>

                {lifeThreatening.map((item) =>
                  renderCheckbox(
                    item,
                    lifeAnswers,
                    setLifeAnswers,
                    COLORS.lifeAccent
                  )
                )}
              </View>

              {/* ================================
                  STYRKEN PÅ EMOSJONER
              ================================= */}

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      COLORS.emotionBackground,
                  },
                ]}
              >
                <Text style={styles.cardTitle}>
                  Styrken på emosjoner
                </Text>

                <Text style={styles.description}>
                  Registrer den høyeste styrken
                  du opplevde denne dagen.
                  1 betyr at du har registrert
                  følelsen, og 10 betyr full styrke.
                </Text>

                {emotions.map((emotion) => {
                  const currentLevel =
                    emotionLevels[emotion];

                  return (
                    <View
                      key={emotion}
                      style={
                        styles.emotionSection
                      }
                    >
                      <View
                        style={
                          styles.emotionHeader
                        }
                      >
                        <Text
                          style={styles.itemText}
                        >
                          {emotion}
                        </Text>

                        <Text
                          style={
                            styles.emotionValue
                          }
                        >
                          {currentLevel == null
                            ? "Ikke registrert"
                            : `${currentLevel} / 10`}
                        </Text>
                      </View>

                      <View
                        style={styles.scaleRow}
                      >
                        {Array.from(
                          { length: 10 },
                          (_, index) => index + 1
                        ).map((level) => {
                          const selected =
                            currentLevel === level;

                          return (
                            <Pressable
                              key={level}
                              style={[
                                styles.scaleButton,
                                selected && {
                                  backgroundColor:
                                    COLORS.primary,
                                },
                              ]}
                              onPress={() => {
                                setEmotionLevels(
                                  (previous) => {
                                    const updated = {
                                      ...previous,
                                    };

                                    if (
                                      updated[
                                        emotion
                                      ] === level
                                    ) {
                                      delete updated[
                                        emotion
                                      ];
                                    } else {
                                      updated[
                                        emotion
                                      ] = level;
                                    }

                                    return updated;
                                  }
                                );

                                markChanged();
                              }}
                            >
                              <Text
                                style={[
                                  styles.scaleText,
                                  selected && {
                                    color:
                                      COLORS.white,
                                  },
                                ]}
                              >
                                {level}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* ================================
                  BEHANDLINGSFORSTYRRENDE ATFERD
              ================================= */}

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      COLORS.behaviorBackground,
                  },
                ]}
              >
                <Text style={styles.cardTitle}>
                  Potensielt behandlingsforstyrrende
                  atferd
                </Text>

                <Text style={styles.description}>
                  Huk av dersom noe av dette
                  har vært aktuelt denne dagen.
                  For skjermtid kan du registrere
                  antall timer.
                </Text>

                {interferingBehaviors.map(
                  (item) =>
                    item === "Skjermtid" ? (
                      <View
                        key={item}
                        style={
                          styles.screenTimeContainer
                        }
                      >
                        <Text
                          style={styles.itemText}
                        >
                          Skjermtid
                        </Text>

                        <View
                          style={
                            styles.screenTimeRow
                          }
                        >
                          <TextInput
                            style={
                              styles.screenTimeInput
                            }
                            placeholder="F.eks. 3,5"
                            placeholderTextColor="#85837C"
                            keyboardType="decimal-pad"
                            value={screenTime}
                            onChangeText={(text) => {
                              if (
                                /^\d*([.,]\d*)?$/.test(
                                  text
                                )
                              ) {
                                setScreenTime(text);
                                markChanged();
                              }
                            }}
                          />

                          <Text
                            style={
                              styles.screenTimeUnit
                            }
                          >
                            timer
                          </Text>
                        </View>
                      </View>
                    ) : (
                      renderCheckbox(
                        item,
                        behaviorAnswers,
                        setBehaviorAnswers,
                        COLORS.behaviorAccent
                      )
                    )
                )}
              </View>

              {/* ================================
                  FERDIGHETER JEG HAR BRUKT
              ================================= */}

              <View
                style={styles.skillsContainer}
              >
                <Text style={styles.cardTitle}>
                  Ferdigheter jeg har brukt
                </Text>

                <Text style={styles.description}>
                  Huk av ferdighetene du brukte
                  denne dagen. Du kan også skrive
                  hvilke konkrete ferdigheter
                  du brukte.
                </Text>

                {skillGroups.map((skill) => {
                  const selected =
                    skillAnswers[
                      skill.name
                    ] === true;

                  return (
                    <View
                      key={skill.name}
                      style={[
                        styles.skillCard,
                        {
                          backgroundColor:
                            skill.background,
                        },
                      ]}
                    >
                      <Pressable
                        style={
                          styles.checkboxRow
                        }
                        onPress={() => {
                          setSkillAnswers(
                            (previous) => ({
                              ...previous,
                              [skill.name]:
                                !previous[
                                  skill.name
                                ],
                            })
                          );

                          markChanged();
                        }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor:
                                skill.accent,
                            },
                            selected && {
                              backgroundColor:
                                skill.accent,
                            },
                          ]}
                        >
                          {selected && (
                            <Text
                              style={
                                styles.checkmark
                              }
                            >
                              ✓
                            </Text>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.skillTitle,
                            {
                              color:
                                skill.accent,
                            },
                          ]}
                        >
                          {skill.name}
                        </Text>
                      </Pressable>

                      {selected && (
                        <TextInput
                          style={styles.textInput}
                          placeholder="Hvilke ferdigheter brukte du?"
                          placeholderTextColor="#85837C"
                          multiline
                          value={
                            skillDetails[
                              skill.name
                            ] ?? ""
                          }
                          onChangeText={(text) => {
                            setSkillDetails(
                              (previous) => ({
                                ...previous,
                                [skill.name]:
                                  text,
                              })
                            );

                            markChanged();
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* ================================
                  MINE NOTATER
              ================================= */}

              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>
                  📝 Mine notater
                </Text>

                <Text style={styles.description}>
                  Hvordan var denne dagen?
                  Er det noe du ønsker å skrive ned?
                  Dette feltet er helt frivillig.
                </Text>

                <TextInput
                  style={styles.notesInput}
                  placeholder="Skriv om dagen din her..."
                  placeholderTextColor="#85837C"
                  multiline
                  textAlignVertical="top"
                  value={dailyNote}
                  onChangeText={(text) => {
                    setDailyNote(text);
                    markChanged();
                  }}
                />
              </View>

              {/* ================================
                  LAGRE DAGBOKSKORT
              ================================= */}

              <Pressable
                style={styles.saveButton}
                onPress={handleSave}
                disabled={
                  busy ||
                  saving ||
                  !diaryKeyReady ||
                  !!recoveryCode ||
                  !!loadError
                }
              >
                <Text
                  style={styles.saveButtonText}
                >
                  {saving
                    ? "Lagrer kryptert ..."
                    : editingEntry
                    ? "Lagre endringer"
                    : "Lagre dagbokskortet"}
                </Text>
              </Pressable>

              {/* ================================
                  AVBRYT REDIGERING
              ================================= */}

              {editingEntry && (
                <Pressable
                  style={[
                    styles.backButton,
                    { marginTop: 16 },
                  ]}
                  onPress={cancelEditing}
                >
                  <Text
                    style={
                      styles.backButtonText
                    }
                  >
                    Avbryt endring
                  </Text>
                </Pressable>
              )}
            </>
          )}

        {/* ==========================================
            BUNNTEKST
        ========================================== */}

        <Text style={styles.footer}>
          Alle følelser er velkomne her. 💚
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================================================
// 18. DESIGN / STYLES
// ==================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#E6EEE8",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },

  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 12,
  },

  dateNavigation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    gap: 10,
  },

  dateCenter: {
    flex: 1,
    alignItems: "center",
  },

  dateArrow: {
    backgroundColor: "#E6EEE8",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  dateArrowDisabled: {
    opacity: 0.35,
  },

  dateArrowText: {
    color: COLORS.primary,
    fontSize: 30,
    lineHeight: 34,
  },

  dateHint: {
    color: COLORS.mutedText,
    fontSize: 12,
    marginTop: 4,
  },

  dateText: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: "center",
    textTransform: "capitalize",
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginTop: 10,
    marginBottom: 24,
  },

  errorText: {
    color: "#A95858",
    marginBottom: 16,
  },

  recoveryCode: {
    color: COLORS.darkGreen,
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 24,
  },

  disabledButton: {
    opacity: 0.45,
  },

  card: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: COLORS.darkGreen,
    marginBottom: 10,
  },

  description: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.mutedText,
    marginBottom: 16,
  },

  itemText: {
    fontSize: 14,
    color: COLORS.bodyText,
    flexShrink: 1,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  checkmark: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15,
  },

  emotionSection: {
    marginBottom: 20,
  },

  emotionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  emotionValue: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 14,
  },

  scaleRow: {
    flexDirection: "row",
    gap: 3,
  },

  scaleButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 7,
    backgroundColor: COLORS.white,
  },

  scaleText: {
    color: COLORS.darkGreen,
    fontSize: 12,
    fontWeight: "600",
  },

  screenTimeContainer: {
    paddingVertical: 12,
    gap: 10,
  },

  screenTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  screenTimeInput: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: 120,
    fontSize: 16,
    color: COLORS.darkGreen,
  },

  screenTimeUnit: {
    fontSize: 14,
    color: COLORS.bodyText,
  },

  skillsContainer: {
    marginBottom: 18,
  },

  skillCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },

  skillTitle: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },

  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    marginTop: 10,
    color: COLORS.darkGreen,
    fontSize: 14,
    textAlignVertical: "top",
  },

  notesCard: {
    backgroundColor: COLORS.notesBackground,
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
  },

  notesTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: COLORS.notesAccent,
    marginBottom: 12,
  },

  notesInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    minHeight: 150,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.darkGreen,
    textAlignVertical: "top",
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },

  footer: {
    textAlign: "center",
    fontSize: 14,
    color: "#85837C",
    marginTop: 28,
  },
});
