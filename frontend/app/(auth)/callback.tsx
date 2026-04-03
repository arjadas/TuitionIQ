import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const exchangeCode = async (): Promise<void> => {
      const codeParam = Array.isArray(params.code) ? params.code[0] : params.code;

      if (!codeParam) {
        if (isMounted) {
          setErrorMessage("Missing login code. Please request a new login link.");
        }
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(codeParam);

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/callback");
      }

      if (!isMounted) {
        return;
      }

      if (error || !data.session) {
        setErrorMessage(error?.message ?? "Could not complete login. Please try again.");
        return;
      }

      setSession(data.session);
      setUser(data.session.user);
      router.replace("/home");
    };

    void exchangeCode();

    return () => {
      isMounted = false;
    };
  }, [params.code, setSession, setUser]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color="#0e7ef2" />
            <Text style={styles.text}>Signing you in...</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f7fa",
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  text: {
    fontSize: 16,
    color: "#0e3050",
  },
  errorText: {
    fontSize: 15,
    color: "#bb1f1f",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
