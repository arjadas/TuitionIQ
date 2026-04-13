import { SafeAreaView, StyleSheet, View } from "react-native";
import { EmailOtpVerificationForm } from "@/src/features/auth/components/EmailOtpVerificationForm";

export default function VerifyEmailScreen()
{
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <EmailOtpVerificationForm />
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
