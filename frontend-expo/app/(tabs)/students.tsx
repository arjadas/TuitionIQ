import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LoadingScreen } from '@/components/common/LoadingScreen';
import { StudentCard } from '@/components/students/StudentCard';
import { colors } from '@/constants/theme';
import { useAppData } from '@/providers/AppDataProvider';
import type { Student } from '@/types';

export default function StudentsScreen() {
  const router = useRouter();
  const { students, loading, deleteStudent } = useAppData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return students;
    }

    return students.filter(
      (student) =>
        student.firstName.toLowerCase().includes(term) ||
        student.lastName.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const handleDelete = (id: number) => {
    Alert.alert('Delete Student', 'Are you sure you want to delete this student?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteStudent(id);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Student }) => {
    return (
      <StudentCard
        student={item}
        onEdit={(student) =>
          router.push({ pathname: '../student-form', params: { id: String(student.id) } })
        }
        onDelete={handleDelete}
      />
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search students..."
          style={styles.searchInput}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.addBtn} onPress={() => router.push('../student-form')}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No students found.</Text>
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
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
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
    marginTop: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
