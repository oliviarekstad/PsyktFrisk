
import { useEffect, useRef, useState } from "react";
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
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

type RecoveryState = "checking" | "ready" | "invalid" | "done";

function getLinkParameters(url: string) {
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  const fragment = url.split("#")[1] ?? "";

  const params = new URLSearchParams(query);

  for (const [key, value] of new URLSearchParams(fragment)) {
    params.set(key, value);
  }

  return params;
}

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<RecoveryState>("checking");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const processing = useRef(false);
  const verified = useRef(false);

  const incomingUrl = Linking.useURL();

  useEffect(() => {
    let active = true;

    async function verifyRecoveryLink() {
      if (!incomingUrl || processing.current || verified.current) {
        if (!incomingUrl && active) {
          setState("invalid");
          setErrorMessage(
            "Åpne passordlenken fra e-posten på denne enheten."
          );
        }
        return;
      }

      processing.current = true;

      try {
        const params = getLinkParameters(incomingUrl);

        const tokenHash = params.get("token_hash");
        const type = params.get("type");

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        const errorDescription = params.get("error_description");

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (error) throw error;
        } else if (
          type === "recovery" &&
          accessToken &&
          refreshToken
        ) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
        } else {
          throw new Error(
            "Lenken mangler gyldig informasjon for passordtilbakestilling."
          );
        }

        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          throw new Error(
            "Kunne ikke bekrefte kontoen. Be om en ny lenke."
          );
        }

        if (!active) return;

        verified.current = true;
        setState("ready");
      } catch (error) {
        if (!active) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Lenken kunne ikke bekreftes."
        );

        setState("invalid");
      } finally {
        processing.current = false;
      }
    }

    verifyRecoveryLink();

    return () => {
      active = false;
    };
  }, [incomingUrl]);

  async function handleSavePassword() {
    if (!verified.current || state !== "ready") {
      Alert.alert(
        "Ikke bekreftet",
        "Du må åpne en gyldig passordlenke fra e-posten."
      );
      return;
    }

    if (password.length < 12) {
      Alert.alert(
        "Passordet er for kort",
        "Bruk minst 12 tegn."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passordene er forskjellige",
        "Skriv inn samme passord i begge feltene."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      verified.current = false;
      setPassword("");
      setConfirmPassword("");

      // Krev vanlig innlogging etter passordendringen.
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        console.warn(
          "Kunne ikke avslutte økten:",
          signOutError.message
        );
      }

      setState("done");
    } catch (error) {
      Alert.alert(
        "Kunne ikke endre passord",
        error instanceof Error
          ? error.message
          : "Prøv igjen senere."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>PsyktFrisk</Text>

        <Text style={styles.subtitle}>
          Små steg. Nye ferdigheter. På din måte.
        </Text>

        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            Opprett nytt passord 💚
          </Text>

          <Text style={styles.welcomeText}>
            Velg et nytt, unikt passord for kontoen din.
          </Text>
        </View>

        <View style={styles.formCard}>
          {state === "checking" ? (
            <>
              <ActivityIndicator size="large" color="#456B60" />
              <Text style={styles.helper}>
                Bekrefter gjenopprettingslenken …
              </Text>
            </>
          ) : state === "invalid" ? (
            <>
              <Text style={styles.heading}>
                Lenken kunne ikke bekreftes
              </Text>

              <Text style={styles.helper}>
                {errorMessage}
              </Text>

              <Text style={styles.helper}>
                Be om en ny passordlenke fra innloggingsskjermen.
              </Text>

              <Pressable
                style={styles.button}
                onPress={() => router.replace("/")}
              >
                <Text style={styles.buttonText}>
                  Tilbake
                </Text>
              </Pressable>
            </>
          ) : state === "done" ? (
            <>
              <Text style={styles.heading}>
                Passordet er oppdatert 💚
              </Text>

              <Text style={styles.helper}>
                Du kan nå logge inn med det nye passordet.
              </Text>

              <Pressable
                style={styles.button}
                onPress={() => router.replace("/")}
              >
                <Text style={styles.buttonText}>
                  Gå til innlogging
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.heading}>
                Velg nytt passord
              </Text>

              <Text style={styles.label}>Nytt passord</Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Minst 12 tegn"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />

              <Text style={styles.label}>
                Bekreft nytt passord
              </Text>

              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Gjenta passordet"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />

              <Pressable
                style={[
                  styles.button,
                  loading && styles.disabled,
                ]}
                disabled={loading}
                onPress={handleSavePassword}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    Lagre nytt passord
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          PsyktFrisk er under utvikling.
          Bruk kun testdata foreløpig.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    marginBottom: 20,
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
    fontSize: 14,
    lineHeight: 21,
    color: "#77766F",
    marginTop: 12,
    marginBottom: 16,
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
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: "#85837C",
    marginTop: 26,
  },
});
