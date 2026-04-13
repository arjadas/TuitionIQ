import { SafeAreaView, StyleSheet, View } from "react-native";
import { SignUpForm } from "@/src/features/auth/components/SignUpForm";

export default function SignUpScreen()
{
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <SignUpForm />
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
