import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingRow } from "@/src/shared/components/ui/SettingRow";
import { SettingsSection } from "@/src/shared/components/ui/SettingsSection";
import { colors, spacing } from "@/src/shared/theme/tokens";

const SUPPORT_EMAIL = "support@tuitioniq.com";

export default function HelpScreen() {
  const emailSupport = (): void => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>SUPPORT</Text>
          <Text style={styles.title}>Help &amp; docs</Text>
        </View>

        <SettingsSection title="Get help" icon="help-circle-outline">
          <SettingRow
            description={SUPPORT_EMAIL}
            icon="mail-outline"
            label="Email support"
            onPress={emailSupport}
            showChevron
          />
          <SettingRow comingSoon icon="document-text-outline" label="Documentation" />
          <SettingRow comingSoon icon="chatbubble-ellipses-outline" label="Send feedback" />
        </SettingsSection>

        <SettingsSection accent={colors.textMuted} icon="information-circle-outline" title="About">
          <SettingRow label="Version" right={<Text style={styles.value}>1.0.0</Text>} />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  headerText: {
    gap: 2,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.action,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
