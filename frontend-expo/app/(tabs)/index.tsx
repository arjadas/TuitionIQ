import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBanner } from '@/components/common/ConnectionBanner';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { StatCard } from '@/components/common/StatCard';
import { PaymentCard } from '@/components/payments/PaymentCard';
import { CURRENT_MONTH, CURRENT_YEAR } from '@/constants/config';
import { colors } from '@/constants/theme';
import { useAppData } from '@/providers/AppDataProvider';
import { formatCurrency } from '@/utils/currency.utils';

export default function DashboardScreen() {
  const router = useRouter();
  const { students, paymentRecords, loading, togglePaymentStatus } = useAppData();

  if (loading) {
    return <LoadingScreen />;
  }

  const overdue = paymentRecords.filter((p) => p.isOverdue);
  const totalOwed = paymentRecords.filter((p) => !p.isPaid).reduce((sum, p) => sum + p.amount, 0);
  const thisMonth = paymentRecords.filter(
    (p) => p.billMonth === CURRENT_MONTH && p.billYear === CURRENT_YEAR
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ConnectionBanner />

      <View style={styles.headerActions}>
        <Pressable
          style={[styles.actionBtn, styles.studentBtn]}
          onPress={() => router.push('../student-form')}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Add Student</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.paymentBtn]}
          onPress={() => router.push('../payment-form')}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Record Payment</Text>
        </Pressable>
      </View>

      <View style={styles.statsWrap}>
        <StatCard
          icon={<Feather name="users" color={colors.primary} size={18} />}
          label="Total Students"
          value={students.length}
          tone="blue"
        />
        <StatCard
          icon={<Feather name="dollar-sign" color={colors.success} size={18} />}
          label="Outstanding"
          value={formatCurrency(totalOwed)}
          tone="green"
        />
        <StatCard
          icon={<Feather name="alert-circle" color={colors.danger} size={18} />}
          label="Overdue"
          value={overdue.length}
          tone="red"
        />
        <StatCard
          icon={<Feather name="calendar" color={colors.primary} size={18} />}
          label="This Month"
          value={thisMonth.length}
          tone="teal"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Payments</Text>
        <View style={styles.list}>
          {paymentRecords.slice(0, 5).map((item) => (
            <PaymentCard
              key={item.id}
              paymentRecord={item}
              onToggle={() => {
                void togglePaymentStatus(item.id, item.isPaid);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.overdueTitle]}>Overdue Payments ({overdue.length})</Text>
        <View style={styles.list}>
          {overdue.slice(0, 5).map((item) => (
            <PaymentCard
              key={item.id}
              paymentRecord={item}
              highlight
              onToggle={() => {
                void togglePaymentStatus(item.id, item.isPaid);
              }}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 30,
    gap: 14,
  },
  headerActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  studentBtn: {
    backgroundColor: colors.primary,
  },
  paymentBtn: {
    backgroundColor: colors.success,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  section: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  overdueTitle: {
    color: colors.danger,
  },
  list: {
    gap: 8,
  },
});
