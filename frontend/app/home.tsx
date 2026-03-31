import { useAuthStore } from "@/src/store/authStore";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Welcome to TuitionIQ</Text>
        <Text style={styles.subheading}>Signed in as {user?.email ?? "teacher"}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f7fa",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0e3050",
  },
  subheading: {
    fontSize: 15,
    color: "#35556d",
  },
});
