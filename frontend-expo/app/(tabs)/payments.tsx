import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PaymentCard } from '@/components/payments/PaymentCard';
import { colors } from '@/constants/theme';
import { useAppData } from '@/providers/AppDataProvider';

export default function PaymentsScreen() {
  const router = useRouter();
  const { paymentRecords, loading, togglePaymentStatus } = useAppData();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Payment Records</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('../payment-form')}>
          <Text style={styles.addBtnText}>Record</Text>
        </Pressable>
      </View>

      <FlatList
        data={paymentRecords}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <PaymentCard
            paymentRecord={item}
            onToggle={() => {
              void togglePaymentStatus(item.id, item.isPaid);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No payment records yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topRow: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
