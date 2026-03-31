import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type CardTone = 'blue' | 'green' | 'red' | 'teal';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: CardTone;
}

const toneBg: Record<CardTone, string> = {
  blue: '#d9e8ff',
  green: '#d8f4ea',
  red: '#fde0e0',
  teal: '#d3f2f3',
};

export const StatCard = ({ icon, label, value, tone }: StatCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={[styles.iconWrap, { backgroundColor: toneBg[tone] }]}>{icon}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: {
    flexShrink: 1,
    gap: 3,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  iconWrap: {
    height: 40,
    width: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
