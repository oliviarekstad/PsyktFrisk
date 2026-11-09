
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import AuthScreen from "../components/AuthScreen";
import { supabase } from "../lib/supabase";

// ==================================================
// 1. MENYKORT PÅ FORSIDEN
// ==================================================

const sections = [
  {
    title: "Dagbokskort",
    description: "Registrer følelser og se mønstre",
    icon: "📔",
    route: "/diary",
  },
  {
    title: "Mine ferdigheter",
    description: "Øv på DBT-ferdigheter i hverdagen",
    icon: "🌱",
    route: null,
  },
  {
    title: "Mine oppgaver",
    description: "Fortsett med øvelsene dine",
    icon: "🧩",
    route: null,
  },
  {
    title: "Min utvikling",
    description: "Se hvordan du utvikler deg over tid",
    icon: "📈",
    route: "/development",
  },
] as const;

// ==================================================
// 2. HJEMMESKJERM OG INNLOGGINGSSTATUS
// ==================================================

export default function HomeScreen() {
  const router = useRouter();

  const [session, setSession] =
    useState<Session | null>(null);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [sessionError, setSessionError] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);

  // ==================================================
  // 3. KONTROLLER INNLOGGING VED OPPSTART
  // ==================================================

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (active) {
          setSession(data.session);
          setSessionError("");
        }
      } catch (error) {
        console.error(
          "Kunne ikke lese innloggingsøkten:",
          error
        );

        if (active) {
          setSessionError(
            "Kunne ikke kontrollere innloggingen."
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    loadSession();

    // Følg med når brukeren logger inn eller ut.

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          if (active) {
            setSession(newSession);
            setSessionError("");
            setCheckingSession(false);
          }
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ==================================================
  // 4. NAVIGASJON
  // ==================================================

  function openSection(
    route: (typeof sections)[number]["route"]
  ) {
    if (route === null) {
      return;
    }

    router.navigate(route);
  }

  // ==================================================
  // 5. LOGG UT
  // ==================================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setSession(null);
    } catch (error) {
      console.error("Utlogging feilet:", error);

      Alert.alert(
        "Kunne ikke logge ut",
        "Prøv igjen om litt."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  // ==================================================
  // 6. LASTESKJERM
  // ==================================================

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#456B60"
        />

        <Text style={styles.loadingText}>
          Åpner PsyktFrisk...
        </Text>
      </SafeAreaView>
    );
  }

  // ==================================================
  // 7. INNLOGGINGSSKJERM
  // ==================================================

  if (!session) {
    return (
      <View style={styles.container}>
        {sessionError !== "" && (
          <Text style={styles.errorText}>
            {sessionError}
          </Text>
        )}

        <AuthScreen />
      </View>
    );
  }

  // ==================================================
  // 8. FORSIDE FOR INNLOGGET BRUKER
  // ==================================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* 8A. Logo */}

        <Text style={styles.logo}>
          PsyktFrisk
        </Text>

        <Text style={styles.subtitle}>
          Små steg. Nye ferdigheter. På din måte.
        </Text>

        {/* 8B. Velkomstkort */}

        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            Hei, du 💛
          </Text>

          <Text style={styles.welcomeText}>
            Du trenger ikke få til alt i dag.
            Det holder å begynne et sted.
          </Text>
        </View>

        {/* 8C. Meny */}

        <Text style={styles.heading}>
          Din hverdag
        </Text>

        {sections.map((section) => (
          <Pressable
            key={section.title}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => openSection(section.route)}
          >
            <Text style={styles.icon}>
              {section.icon}
            </Text>

            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {section.title}
              </Text>

              <Text style={styles.cardDescription}>
                {section.description}
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        ))}

        {/* 8D. Konto */}

        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>
            Min konto
          </Text>

          <Text style={styles.accountLabel}>
            Logget inn som
          </Text>

          <Text style={styles.accountEmail}>
            {session.user.email ?? "Ukjent e-post"}
          </Text>

          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={styles.logoutButton}
          >
            {loggingOut ? (
              <ActivityIndicator color="#456B60" />
            ) : (
              <Text style={styles.logoutText}>
                Logg ut
              </Text>
            )}
          </Pressable>
        </View>

        {/* 8E. Informasjon */}

        <Text style={styles.testNotice}>
          PsyktFrisk er under utvikling.
          Bruk bare testdata foreløpig.
        </Text>

        {/* 8F. Bunntekst */}

        <Text style={styles.footer}>
          Du er mer enn det du føler akkurat nå.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ==================================================
// 9. DESIGN
// ==================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F6F2",
  },

  content: {
    padding: 24,
    paddingBottom: 40,
  },

  centered: {
    flex: 1,
    backgroundColor: "#F8F6F2",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    fontSize: 14,
    color: "#456B60",
    marginTop: 16,
  },

  errorText: {
    fontSize: 13,
    color: "#9B4943",
    textAlign: "center",
    padding: 12,
  },

  logo: {
    fontSize: 32,
    fontWeight: "700",
    color: "#456B60",
    marginTop: 12,
  },

  subtitle: {
    fontSize: 14,
    color: "#77766F",
    marginTop: 6,
    marginBottom: 28,
  },

  welcome: {
    backgroundColor: "#E6EEE8",
    padding: 22,
    borderRadius: 20,
    marginBottom: 30,
  },

  welcomeTitle: {
    fontSize: 23,
    fontWeight: "600",
    color: "#34594D",
    marginBottom: 8,
  },

  welcomeText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#40584F",
  },

  heading: {
    fontSize: 20,
    fontWeight: "600",
    color: "#303B36",
    marginBottom: 14,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAE8E2",
  },

  cardPressed: {
    opacity: 0.7,
  },

  icon: {
    fontSize: 27,
    marginRight: 14,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#303B36",
    marginBottom: 4,
  },

  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#77766F",
  },

  arrow: {
    fontSize: 27,
    color: "#789287",
    marginLeft: 8,
  },

  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#DDE7E0",
  },

  accountTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#34594D",
    marginBottom: 14,
  },

  accountLabel: {
    fontSize: 12,
    color: "#77766F",
    marginBottom: 5,
  },

  accountEmail: {
    fontSize: 15,
    color: "#303B36",
    marginBottom: 18,
  },

  logoutButton: {
    borderWidth: 1,
    borderColor: "#456B60",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#456B60",
  },

  testNotice: {
    fontSize: 12,
    lineHeight: 19,
    color: "#85837C",
    textAlign: "center",
    marginTop: 20,
  },

  footer: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "#85837C",
    marginTop: 22,
  },
});
