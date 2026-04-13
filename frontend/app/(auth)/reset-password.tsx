import { SafeAreaView, StyleSheet, View } from "react-native";
import { ResetPasswordForm } from "@/src/features/auth/components/ResetPasswordForm";

export default function ResetPasswordScreen()
{
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ResetPasswordForm />
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
