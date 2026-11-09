
// ==================================================
// 1. IMPORTER
// ==================================================

import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

// ==================================================
// 2. TYPER OG INNLOGGINGSSKJERM
// ==================================================

type AuthMode = "login" | "register" | "forgot";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ==================================================
  // 3. BYTT MELLOM SKJERMENE
  // ==================================================

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setMessage("");
  }

  // ==================================================
  // 4. REGISTRERING OG INNLOGGING
  // ==================================================

  async function handleSubmit() {
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail || !password) {
      Alert.alert(
        "Mangler informasjon",
        "Skriv inn både e-postadresse og passord."
      );
      return;
    }

    if (mode === "register" && password.length < 8) {
      Alert.alert(
        "Passordet er for kort",
        "Bruk et passord på minst 8 tegn."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanedEmail,
          password,
        });

        if (error) throw error;

        setPassword("");

        if (data.session) {
          setMessage(
            "Kontoen er opprettet. Du er nå logget inn."
          );
        } else {
          setMode("login");
          setMessage(
            "Hvis registreringen ble godkjent, vil du motta " +
              "en e-post for å bekrefte kontoen. " +
              "Sjekk også søppelpost."
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: cleanedEmail,
            password,
          });

        if (error) throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "En ukjent feil oppstod.";

      Alert.alert(
        mode === "register"
          ? "Kunne ikke registrere konto"
          : "Kunne ikke logge inn",
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // 5. BE OM TILBAKESTILLING AV PASSORD
  // ==================================================

  async function handleForgotPassword() {
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail) {
      Alert.alert(
        "Mangler e-postadresse",
        "Skriv inn e-postadressen din først."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanedEmail,
          {
            redirectTo: "psyktfrisk://auth/reset-password",
          }
        );

      if (error) throw error;

      setMessage(
        "Hvis e-postadressen er registrert, vil du motta " +
          "en lenke for å tilbakestille passordet. " +
          "Sjekk også søppelpost."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "En ukjent feil oppstod.";

      if (
        errorMessage.toLowerCase().includes("rate limit")
      ) {
        Alert.alert(
          "For mange e-poster",
          "Supabase har midlertidig begrenset utsendingen. " +
            "Vent før du prøver igjen."
        );
      } else {
        Alert.alert(
          "Kunne ikke sende e-post",
          errorMessage
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // 6. SKJERMENS INNHOLD
  // ==================================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios" ? "padding" : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* 6A. Logo */}

        <Text style={styles.logo}>PsyktFrisk</Text>

        <Text style={styles.subtitle}>
          Små steg. Nye ferdigheter. På din måte.
        </Text>

        {/* 6B. Velkomsttekst */}

        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            {mode === "login"
              ? "Velkommen tilbake 💚"
              : mode === "register"
              ? "Velkommen til PsyktFrisk 💚"
              : "Glemt passordet? 💚"}
          </Text>

          <Text style={styles.welcomeText}>
            {mode === "login"
              ? "Logg inn for å fortsette."
              : mode === "register"
              ? "Opprett en konto for å komme i gang."
              : "Skriv inn e-postadressen din, så sender vi deg en lenke for å opprette et nytt passord."}
          </Text>
        </View>

        {/* 6C. Skjema */}

        <View style={styles.formCard}>
          <Text style={styles.heading}>
            {mode === "login"
              ? "Logg inn"
              : mode === "register"
              ? "Opprett konto"
              : "Tilbakestill passord"}
          </Text>

          <Text style={styles.label}>
            E-postadresse
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="din@epost.no"
            placeholderTextColor="#999999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
          />

          {/* 6D. Passordfelt */}

          {mode !== "forgot" && (
            <>
              <Text style={styles.label}>
                Passord
              </Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Skriv inn passord"
                placeholderTextColor="#999999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={
                  mode === "register"
                    ? "new-password"
                    : "current-password"
                }
                editable={!loading}
              />

              {mode === "register" && (
                <Text style={styles.helper}>
                  Bruk minst 8 tegn. Velg et unikt passord.
                </Text>
              )}
            </>
          )}

          {/* 6E. Glemt passord-lenke */}

          {mode === "login" && (
            <Pressable
              disabled={loading}
              onPress={() => changeMode("forgot")}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>
                Glemt passord?
              </Text>
            </Pressable>
          )}

          {/* 6F. Hovedknapp */}

          <Pressable
            onPress={
              mode === "forgot"
                ? handleForgotPassword
                : handleSubmit
            }
            disabled={loading}
            style={[
              styles.button,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "login"
                  ? "Logg inn"
                  : mode === "register"
                  ? "Registrer deg"
                  : "Send e-post"}
              </Text>
            )}
          </Pressable>

          {/* 6G. Tilbakemelding */}

          {message !== "" && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>
                {message}
              </Text>
            </View>
          )}

          {/* 6H. Bytt mellom skjermene */}

          {mode === "forgot" ? (
            <Pressable
              disabled={loading}
              onPress={() => changeMode("login")}
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>
                Tilbake til innlogging
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={loading}
              onPress={() =>
                changeMode(
                  mode === "login"
                    ? "register"
                    : "login"
                )
              }
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>
                {mode === "login"
                  ? "Har du ikke konto? Registrer deg"
                  : "Har du allerede konto? Logg inn"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* 6I. Informasjon */}

        <Text style={styles.footer}>
          PsyktFrisk er under utvikling.
          Bruk kun testdata foreløpig.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==================================================
// 7. DESIGN
// ==================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F6F2",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 48,
  },

  logo: {
    fontSize: 34,
    fontWeight: "700",
    color: "#456B60",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: "#77766F",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 30,
  },

  welcome: {
    backgroundColor: "#E6EEE8",
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
  },

  welcomeTitle: {
    fontSize: 23,
    fontWeight: "600",
    color: "#34594D",
    marginBottom: 8,
  },

  welcomeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#40584F",
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#EAE8E2",
  },

  heading: {
    fontSize: 22,
    fontWeight: "600",
    color: "#303B36",
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#40584F",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#F8F6F2",
    borderWidth: 1,
    borderColor: "#DDE4DE",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: "#303B36",
    marginBottom: 18,
  },

  helper: {
    fontSize: 12,
    color: "#77766F",
    marginBottom: 14,
    lineHeight: 18,
  },

  forgotButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    marginBottom: 10,
  },

  forgotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#456B60",
  },

  button: {
    backgroundColor: "#456B60",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 4,
  },

  disabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  messageBox: {
    backgroundColor: "#E6EEE8",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#34594D",
  },

  switchButton: {
    paddingVertical: 18,
    alignItems: "center",
  },

  switchText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#456B60",
    textAlign: "center",
  },

  footer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: "#85837C",
    marginTop: 26,
  },
});
