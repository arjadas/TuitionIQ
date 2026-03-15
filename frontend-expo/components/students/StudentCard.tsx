import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Student } from '@/types';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

export const StudentCard = ({ student, onEdit, onDelete }: StudentCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>
          {student.firstName} {student.lastName}
        </Text>
        <Text style={styles.email}>{student.email}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => onEdit(student)} style={styles.iconBtn}>
          <Feather name="edit-2" size={16} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => onDelete(student.id)} style={styles.iconBtn}>
          <Feather name="trash-2" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    height: 34,
    width: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});
