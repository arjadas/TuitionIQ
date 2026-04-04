import { CreateOrgForm } from "@/src/features/organizations/components/CreateOrgForm";
import { SafeAreaView, StyleSheet, View } from "react-native";

export default function CreateOrganizationScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <CreateOrgForm />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
});
