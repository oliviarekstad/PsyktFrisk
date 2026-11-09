
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { supabase } from "../lib/supabase";
import { getDiaryKey } from "../lib/keyManager";
import { decryptDiary } from "../lib/encryption";

// =============================================
// 1. DESIGN
// =============================================

const C = {
  background: "#F8F6F2",
  primary: "#456B60",
  dark: "#34594D",
  text: "#40584F",
  muted: "#77766F",
  white: "#FFFFFF",
  green: "#E6F2E8",
  blue: "#E5F0FB",
  purple: "#F0E8FA",
  pink: "#FBE9ED",
};

const EMOTIONS = [
  "Trist / lei deg",
  "Engstelig / redd",
  "Irritert / sint",
  "Glad",
  "Stress",
] as const;

type Emotion = (typeof EMOTIONS)[number];
type Period = 7 | 28 | 56;

type DiaryEntry = {
  date: string;
  emotions: Record<Emotion, number | null>;
  screenTime: number | null;
  skills: string[];
  note: string;
};

type SavedDiary = {
  emotionLevels?: Record<string, number>;
  screenTime?: string;
  skillAnswers?: Record<string, boolean>;
  dailyNote?: string;
};

const SKILLS = [
  "Mindfulness",
  "Holde ut-ferdigheter",
  "Relasjonsferdigheter",
  "Følelsesferdigheter",
];

// =============================================
// 2. DATO OG BEREGNINGER
// =============================================

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) /
    values.length;
}

function numberText(value: number | null): string {
  return value === null ? "–" : value.toFixed(1).replace(".", ",");
}

function getPeriodStart(period: Period): string {
  const date = new Date();
  date.setDate(date.getDate() - period + 1);
  return dateKey(date);
}

// =============================================
// 3. HENT OG DEKRYPTER DAGBOKKORT
// =============================================

async function loadEntries(): Promise<DiaryEntry[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Du er ikke innlogget.");

  const key = await getDiaryKey(user.id);

  if (!key) {
    throw new Error(
      "Krypteringsnøkkelen mangler. Åpne Dagbokskort for å gjenopprette nøkkelen."
    );
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .select("entry_date, ciphertext")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row): DiaryEntry => {
    const saved = decryptDiary<SavedDiary>(
      key,
      user.id,
      row.entry_date,
      row.ciphertext
    );

    const emotions = {} as DiaryEntry["emotions"];

    for (const name of EMOTIONS) {
      const value = saved.emotionLevels?.[name];

      emotions[name] =
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 1 &&
        value <= 10
          ? value
          : null;
    }

    const rawScreenTime = saved.screenTime?.trim() ?? "";
    const parsedScreenTime = Number(
      rawScreenTime.replace(",", ".")
    );

    return {
      date: row.entry_date,
      emotions,
      screenTime:
        rawScreenTime !== "" &&
        Number.isFinite(parsedScreenTime) &&
        parsedScreenTime >= 0
          ? parsedScreenTime
          : null,
      skills: Object.entries(saved.skillAnswers ?? {})
        .filter(([, selected]) => selected === true)
        .map(([name]) => name),
      note: saved.dailyNote ?? "",
    };
  });
}

// =============================================
// 4. GJENBRUKBARE KOMPONENTER
// =============================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatCard({
  label,
  value,
  color = C.green,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function PeriodButton({
  value,
  selected,
  onPress,
}: {
  value: Period;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.periodButton,
        selected && styles.periodButtonSelected,
      ]}
    >
      <Text
        style={[
          styles.periodText,
          selected && styles.periodTextSelected,
        ]}
      >
        {value} dager
      </Text>
    </Pressable>
  );
}

// =============================================
// 5. HOVEDSKJERM
// =============================================

export default function DevelopmentScreen() {
  const router = useRouter();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>(7);
  const [emotion, setEmotion] = useState<Emotion>("Stress");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Hent oppdaterte data hver gang siden åpnes.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refresh() {
        setLoading(true);
        setError(null);

        try {
          const result = await loadEntries();

          if (active) {
            setEntries(result);
          }
        } catch (err) {
          if (active) {
            setEntries([]);
            setError(
              err instanceof Error
                ? err.message
                : "Kunne ikke hente registreringene."
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      refresh();

      return () => {
        active = false;
      };
    }, [])
  );

  const visibleEntries = useMemo(() => {
    const start = getPeriodStart(period);
    const today = dateKey(new Date());

    return entries.filter(
      (entry) => entry.date >= start && entry.date <= today
    );
  }, [entries, period]);

  const emotionValues = visibleEntries
    .map((entry) => entry.emotions[emotion])
    .filter((value): value is number => value !== null);

  const emotionAverage = average(emotionValues);

  const screenTimeValues = visibleEntries
    .map((entry) => entry.screenTime)
    .filter((value): value is number => value !== null);

  const screenTimeAverage = average(screenTimeValues);

  const selectedEntry = entries.find(
    (entry) => entry.date === selectedDate
  );

  const notes = [...entries]
    .filter((entry) => entry.note.trim().length > 0)
    .reverse();

  const maxEmotion = Math.max(1, ...emotionValues);

  const monthLabel = calendarMonth.toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const registeredDates = new Set(entries.map((entry) => entry.date));

  function changeMonth(amount: number) {
    setCalendarMonth(
      new Date(year, month + amount, 1)
    );
    setSelectedDate(null);
  }

  // =============================================
  // 6. LASTING OG FEIL
  // =============================================

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>
          Laster din utvikling...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>
          Kunne ikke vise Min utvikling
        </Text>
        <Text style={styles.errorText}>{error}</Text>

        <Pressable
          style={styles.mainButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.mainButtonText}>
            Tilbake til forsiden
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // =============================================
  // 7. INNHOLD
  // =============================================

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.replace("/")}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Tilbake</Text>
        </Pressable>

        <Text style={styles.title}>Min utvikling</Text>
        <Text style={styles.subtitle}>
          Se mønstre, følelser og små fremskritt over tid.
        </Text>

        {entries.length === 0 && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              Din utvikling starter her 💚
            </Text>
            <Text style={styles.body}>
              Du har ingen lagrede dagbokskort ennå.
              Når du fyller ut ditt første kort, vil
              utviklingen din vises her.
            </Text>

            <Pressable
              style={styles.mainButton}
              onPress={() => router.push("/diary")}
            >
              <Text style={styles.mainButtonText}>
                Fyll ut dagbokskort
              </Text>
            </Pressable>
          </View>
        )}

        <Section title="Velg tidsperiode">
          <View style={styles.periodRow}>
            {([7, 28, 56] as Period[]).map((value) => (
              <PeriodButton
                key={value}
                value={value}
                selected={period === value}
                onPress={() => setPeriod(value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Din oversikt">
          <View style={styles.statsGrid}>
            <StatCard
              label="Registrerte dager"
              value={String(visibleEntries.length)}
              color={C.green}
            />
            <StatCard
              label="Gjennomsnittlig skjermtid"
              value={
                screenTimeAverage === null
                  ? "–"
                  : `${numberText(screenTimeAverage)} t`
              }
              color={C.blue}
            />
            <StatCard
              label="Dager med ferdigheter"
              value={String(
                visibleEntries.filter(
                  (entry) => entry.skills.length > 0
                ).length
              )}
              color={C.purple}
            />
            <StatCard
              label="Notater"
              value={String(
                visibleEntries.filter(
                  (entry) => entry.note.trim().length > 0
                ).length
              )}
              color={C.pink}
            />
          </View>
        </Section>

        <Section title="Følelsene dine">
          <Text style={styles.body}>
            Velg en følelse for å se utviklingen.
          </Text>

          <View style={styles.chipRow}>
            {EMOTIONS.map((name) => (
              <Pressable
                key={name}
                onPress={() => setEmotion(name)}
                style={[
                  styles.chip,
                  emotion === name && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    emotion === name && styles.chipTextSelected,
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {emotion}
            </Text>

            {emotionValues.length === 0 ? (
              <EmptyMessage text="Ingen registreringer av denne følelsen i valgt periode." />
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <StatCard
                    label="Gjennomsnitt"
                    value={numberText(emotionAverage)}
                  />
                  <StatCard
                    label="Høyeste verdi"
                    value={String(Math.max(...emotionValues))}
                    color={C.blue}
                  />
                  <StatCard
                    label="Laveste verdi"
                    value={String(Math.min(...emotionValues))}
                    color={C.purple}
                  />
                </View>

                <Text style={styles.chartHint}>
                  Registrerte verdier fra 1 til 10
                </Text>

                {visibleEntries
                  .filter((entry) => entry.emotions[emotion] !== null)
                  .map((entry) => {
                    const value = entry.emotions[emotion]!;
                    return (
                      <View key={entry.date} style={styles.barRow}>
                        <Text style={styles.barLabel}>
                          {parseDate(entry.date).toLocaleDateString(
                            "nb-NO",
                            { day: "numeric", month: "short" }
                          )}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${(value / 10) * 100}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.barValue}>
                          {value}
                        </Text>
                      </View>
                    );
                  })}
              </>
            )}
          </View>
        </Section>

        <Section title="Ferdigheter du har brukt">
          {visibleEntries.length === 0 ? (
            <EmptyMessage text="Ingen registreringer i valgt periode." />
          ) : (
            SKILLS.map((skill) => {
              const count = visibleEntries.filter(
                (entry) => entry.skills.includes(skill)
              ).length;

              return (
                <View key={skill} style={styles.skillRow}>
                  <Text style={styles.skillText}>{skill}</Text>
                  <Text style={styles.skillCount}>
                    {count} dager
                  </Text>
                </View>
              );
            })
          )}
        </Section>

        <Section title="Skjermtid">
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              Gjennomsnitt:{" "}
              {screenTimeAverage === null
                ? "Ingen data"
                : `${numberText(screenTimeAverage)} timer`}
            </Text>

            {visibleEntries
              .filter((entry) => entry.screenTime !== null)
              .map((entry) => (
                <View key={entry.date} style={styles.barRow}>
                  <Text style={styles.barLabel}>
                    {parseDate(entry.date).toLocaleDateString(
                      "nb-NO",
                      { day: "numeric", month: "short" }
                    )}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: "#7B9CB8",
                          width: `${
                            Math.min(
                              100,
                              ((entry.screenTime ?? 0) /
                                Math.max(8, ...screenTimeValues)) *
                                100
                            )
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>
                    {entry.screenTime}
                  </Text>
                </View>
              ))}

            {screenTimeValues.length === 0 && (
              <EmptyMessage text="Ingen skjermtid registrert i valgt periode." />
            )}
          </View>
        </Section>

        <Section title="Din kalender">
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => changeMonth(-1)}>
                <Text style={styles.calendarArrow}>‹</Text>
              </Pressable>

              <Text style={styles.calendarTitle}>
                {monthLabel.charAt(0).toUpperCase() +
                  monthLabel.slice(1)}
              </Text>

              <Pressable onPress={() => changeMonth(1)}>
                <Text style={styles.calendarArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map(
                (day) => (
                  <View key={day} style={styles.calendarCell}>
                    <Text style={styles.weekday}>{day}</Text>
                  </View>
                )
              )}

              {Array.from(
                { length: firstWeekday },
                (_, index) => (
                  <View
                    key={`empty-${index}`}
                    style={styles.calendarCell}
                  />
                )
              )}

              {Array.from(
                { length: daysInMonth },
                (_, index) => {
                  const day = index + 1;
                  const date = dateKey(
                    new Date(year, month, day)
                  );
                  const hasEntry = registeredDates.has(date);
                  const selected = selectedDate === date;

                  return (
                    <Pressable
                      key={date}
                      onPress={() =>
                        setSelectedDate(
                          selected ? null : date
                        )
                      }
                      style={styles.calendarCell}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          hasEntry && styles.registeredDay,
                          selected && styles.selectedDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            (hasEntry || selected) &&
                              styles.registeredDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>

            <Text style={styles.calendarLegend}>
              Grønne dager = lagret dagbokskort
            </Text>
          </View>

          {selectedDate && (
            <View style={styles.selectedCard}>
              <Text style={styles.cardHeading}>
                {formatDate(selectedDate)}
              </Text>

              {!selectedEntry ? (
                <Text style={styles.body}>
                  Ingen dagbokregistrering denne dagen.
                </Text>
              ) : (
                <>
                  {EMOTIONS.map((name) => (
                    <View key={name} style={styles.detailRow}>
                      <Text style={styles.body}>{name}</Text>
                      <Text style={styles.detailValue}>
                        {selectedEntry.emotions[name] ?? "–"}
                        {selectedEntry.emotions[name] !== null
                          ? " / 10"
                          : ""}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.detailHeading}>
                    Ferdigheter
                  </Text>
                  <Text style={styles.body}>
                    {selectedEntry.skills.length > 0
                      ? selectedEntry.skills.join(", ")
                      : "Ingen registrert"}
                  </Text>

                  <Text style={styles.detailHeading}>
                    Skjermtid
                  </Text>
                  <Text style={styles.body}>
                    {selectedEntry.screenTime === null
                      ? "Ikke registrert"
                      : `${selectedEntry.screenTime} timer`}
                  </Text>

                  <Text style={styles.detailHeading}>
                    Notat
                  </Text>
                  <Text style={styles.body}>
                    {selectedEntry.note.trim() ||
                      "Ingen notat denne dagen."}
                  </Text>
                </>
              )}
            </View>
          )}
        </Section>

        <Section title="Mine notater">
          {notes.length === 0 ? (
            <EmptyMessage text="Du har ikke skrevet noen notater ennå." />
          ) : (
            notes.map((entry) => (
              <View key={entry.date} style={styles.noteCard}>
                <Text style={styles.noteDate}>
                  {formatDate(entry.date)}
                </Text>
                <Text style={styles.body}>
                  {entry.note}
                </Text>
              </View>
            ))
          )}
        </Section>

        <Pressable
          style={styles.mainButton}
          onPress={() => router.push("/diary")}
        >
          <Text style={styles.mainButtonText}>
            Åpne Dagbokskort
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================
// 8. STILER
// =============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  content: {
    padding: 22,
    paddingBottom: 55,
    gap: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  backText: {
    color: C.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: C.primary,
  },
  subtitle: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: -12,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: C.dark,
  },
  body: {
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyText: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 12,
  },
  welcomeCard: {
    backgroundColor: C.green,
    padding: 22,
    borderRadius: 20,
    gap: 14,
  },
  welcomeTitle: {
    color: C.dark,
    fontSize: 20,
    fontWeight: "700",
  },
  mainButton: {
    backgroundColor: C.primary,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  mainButtonText: {
    color: C.white,
    fontWeight: "700",
    fontSize: 15,
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
  },
  periodButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: C.white,
    alignItems: "center",
  },
  periodButtonSelected: {
    backgroundColor: C.primary,
  },
  periodText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  periodTextSelected: {
    color: C.white,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    padding: 16,
    borderRadius: 16,
    gap: 6,
  },
  statValue: {
    fontSize: 25,
    fontWeight: "800",
    color: C.dark,
  },
  statLabel: {
    fontSize: 12,
    color: C.text,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: C.primary,
  },
  chipText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: C.white,
  },
  chartCard: {
    backgroundColor: C.white,
    padding: 17,
    borderRadius: 18,
    gap: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.dark,
  },
  chartHint: {
    fontSize: 12,
    color: C.muted,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 25,
  },
  barLabel: {
    width: 52,
    fontSize: 11,
    color: C.muted,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: C.background,
    borderRadius: 8,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: C.primary,
    borderRadius: 8,
  },
  barValue: {
    width: 34,
    fontSize: 12,
    fontWeight: "700",
    color: C.dark,
    textAlign: "right",
  },
  skillRow: {
    backgroundColor: C.purple,
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  skillText: {
    flex: 1,
    fontSize: 14,
    color: C.dark,
  },
  skillCount: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primary,
  },
  calendarCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 15,
    gap: 15,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.dark,
  },
  calendarArrow: {
    color: C.primary,
    fontSize: 30,
    paddingHorizontal: 10,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2857%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  registeredDay: {
    backgroundColor: C.primary,
  },
  selectedDay: {
    backgroundColor: C.dark,
    borderWidth: 2,
    borderColor: "#9CC6B0",
  },
  dayText: {
    color: C.text,
    fontSize: 13,
  },
  registeredDayText: {
    color: C.white,
    fontWeight: "700",
  },
  calendarLegend: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
  },
  selectedCard: {
    backgroundColor: C.green,
    padding: 18,
    borderRadius: 18,
    gap: 9,
  },
  cardHeading: {
    color: C.dark,
    fontSize: 17,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailValue: {
    color: C.dark,
    fontWeight: "700",
  },
  detailHeading: {
    color: C.dark,
    fontWeight: "700",
    marginTop: 8,
  },
  noteCard: {
    backgroundColor: C.pink,
    padding: 17,
    borderRadius: 16,
    gap: 8,
  },
  noteDate: {
    fontWeight: "700",
    color: C.dark,
    fontSize: 14,
  },
  loadingText: {
    color: C.primary,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: C.dark,
    textAlign: "center",
  },
  errorText: {
    color: C.text,
    textAlign: "center",
    lineHeight: 22,
  },
});
