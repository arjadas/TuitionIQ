import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { PaymentRecord } from '@/types';
import { formatCurrency } from '@/utils/currency.utils';
import { formatDate } from '@/utils/date.utils';

interface PaymentCardProps {
  paymentRecord: PaymentRecord;
  onToggle: () => void;
  highlight?: boolean;
}

export const PaymentCard = ({ paymentRecord, onToggle, highlight }: PaymentCardProps) => {
  return (
    <View style={[styles.card, highlight ? styles.highlight : null]}>
      <View style={styles.topRow}>
        <Text style={styles.studentName}>{paymentRecord.studentName}</Text>
        <Text style={styles.monthLabel}>
          {paymentRecord.monthName} {paymentRecord.billYear}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.amount}>{formatCurrency(paymentRecord.amount)}</Text>
        <Text style={styles.metaText}>Due: {formatDate(paymentRecord.dueDate)}</Text>
      </View>

      {paymentRecord.paymentDate ? (
        <Text style={styles.paidText}>Paid: {formatDate(paymentRecord.paymentDate)}</Text>
      ) : null}

      <Pressable
        onPress={onToggle}
        style={[styles.toggleBtn, paymentRecord.isPaid ? styles.paidBtn : styles.unpaidBtn]}
      >
        <Feather
          name={paymentRecord.isPaid ? 'check-circle' : 'x-circle'}
          size={16}
          color={paymentRecord.isPaid ? colors.success : colors.textMuted}
        />
        <Text style={[styles.toggleBtnText, paymentRecord.isPaid ? styles.paidTextStrong : null]}>
          {paymentRecord.isPaid ? 'Paid' : 'Unpaid'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 9,
  },
  highlight: {
    borderColor: '#f5aaaa',
    backgroundColor: '#fff4f4',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  studentName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    flexShrink: 1,
  },
  monthLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  amount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  paidText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paidBtn: {
    backgroundColor: colors.successSoft,
  },
  unpaidBtn: {
    backgroundColor: '#e8edf3',
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  paidTextStrong: {
    color: colors.success,
  },
});
