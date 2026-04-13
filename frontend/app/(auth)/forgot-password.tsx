import { SafeAreaView, StyleSheet, View } from "react-native";
import { ForgotPasswordForm } from "@/src/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordScreen()
{
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ForgotPasswordForm />
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
