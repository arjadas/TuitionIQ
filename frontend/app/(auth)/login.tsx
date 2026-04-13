import { SafeAreaView, StyleSheet, View } from "react-native";
import { LoginForm } from "@/src/features/auth/components/LoginForm";

export default function LoginScreen()
{
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <LoginForm />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
});
