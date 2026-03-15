import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAppData } from '@/providers/AppDataProvider';
import type { CreateStudentDto, UpdateStudentDto } from '@/types';

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function StudentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { students, createStudent, updateStudent } = useAppData();

  const editingStudent = useMemo(() => {
    if (!id) {
      return undefined;
    }
    return students.find((item) => item.id === Number(id));
  }, [id, students]);

  const [formData, setFormData] = useState<CreateStudentDto>({
    firstName: editingStudent?.firstName ?? '',
    lastName: editingStudent?.lastName ?? '',
    email: editingStudent?.email ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editingStudent ? 'Edit Student' : 'Add Student' });
  }, [editingStudent, navigation]);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      nextErrors.firstName = 'First name is required.';
    } else if (formData.firstName.trim().length > 50) {
      nextErrors.firstName = 'First name must be 50 characters or less.';
    }

    if (!formData.lastName.trim()) {
      nextErrors.lastName = 'Last name is required.';
    } else if (formData.lastName.trim().length > 50) {
      nextErrors.lastName = 'Last name must be 50 characters or less.';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const payload: CreateStudentDto = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
    };

    let success = false;
    if (editingStudent) {
      const updatePayload: UpdateStudentDto = {
        ...payload,
        enrollmentDate: editingStudent.enrollmentDate,
      };
      success = await updateStudent(editingStudent.id, updatePayload);
    } else {
      success = await createStudent(payload);
    }

    setIsSubmitting(false);
    if (success) {
      router.back();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          value={formData.firstName}
          onChangeText={(value) => {
            setFormData((prev) => ({ ...prev, firstName: value }));
            if (errors.firstName) {
              setErrors((prev) => ({ ...prev, firstName: undefined }));
            }
          }}
          style={[styles.input, errors.firstName ? styles.inputError : null]}
          placeholder="Ariana"
          placeholderTextColor={colors.textMuted}
        />
        {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          value={formData.lastName}
          onChangeText={(value) => {
            setFormData((prev) => ({ ...prev, lastName: value }));
            if (errors.lastName) {
              setErrors((prev) => ({ ...prev, lastName: undefined }));
            }
          }}
          style={[styles.input, errors.lastName ? styles.inputError : null]}
          placeholder="Johnson"
          placeholderTextColor={colors.textMuted}
        />
        {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={formData.email}
          onChangeText={(value) => {
            setFormData((prev) => ({ ...prev, email: value }));
            if (errors.email) {
              setErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          style={[styles.input, errors.email ? styles.inputError : null]}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="student@email.com"
          placeholderTextColor={colors.textMuted}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Create Student'}
          </Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
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
    padding: 16,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  buttonRow: {
    marginTop: 10,
    gap: 10,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e4e9f0',
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
});
