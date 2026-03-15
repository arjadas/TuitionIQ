import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useApiHealth } from '@/hooks/useApiHealth';

export const ConnectionBanner = () => {
  const { status, retry, lastChecked } = useApiHealth();

  if (status === 'connected') {
    return null;
  }

  if (status === 'checking') {
    return (
      <View style={[styles.container, styles.warning]}>
        <Text style={styles.warningText}>Checking connection to API...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.danger]}>
      <Text style={styles.dangerText}>Cannot connect to server.</Text>
      <Pressable onPress={retry} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
      {lastChecked ? (
        <Text style={styles.metaText}>Last checked: {lastChecked.toLocaleTimeString()}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: '#ffbe6f',
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#f29b9b',
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  dangerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  metaText: {
    color: '#8a2e2e',
    fontSize: 11,
  },
});
