import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CURRENT_MONTH, CURRENT_YEAR, MONTHS } from '@/constants/config';
import { colors } from '@/constants/theme';
import { useAppData } from '@/providers/AppDataProvider';
import type { CreatePaymentRecordDto } from '@/types';

interface FormErrors {
  studentId?: string;
  billYear?: string;
  amount?: string;
  notes?: string;
}

export default function PaymentFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { students, createPaymentRecord } = useAppData();

  const [formData, setFormData] = useState<CreatePaymentRecordDto>({
    studentId: 0,
    billYear: CURRENT_YEAR,
    billMonth: CURRENT_MONTH,
    amount: 0,
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Record Payment' });
  }, [navigation]);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!formData.studentId || formData.studentId === 0) {
      nextErrors.studentId = 'Please select a student.';
    }

    if (formData.billYear < 2020 || formData.billYear > 2100) {
      nextErrors.billYear = 'Year must be between 2020 and 2100.';
    }

    if (!formData.amount || formData.amount <= 0) {
      nextErrors.amount = 'Amount must be greater than 0.';
    } else if (formData.amount > 10000) {
      nextErrors.amount = 'Amount cannot exceed $10,000.';
    }

    if (formData.notes && formData.notes.length > 500) {
      nextErrors.notes = 'Notes must be 500 characters or less.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const success = await createPaymentRecord({
      ...formData,
      notes: formData.notes?.trim() || undefined,
    });
    setIsSubmitting(false);

    if (success) {
      router.back();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Student</Text>
        <View style={[styles.pickerWrap, errors.studentId ? styles.inputError : null]}>
          <Picker
            selectedValue={formData.studentId}
            onValueChange={(value) => {
              setFormData((prev) => ({ ...prev, studentId: Number(value) }));
              if (errors.studentId) {
                setErrors((prev) => ({ ...prev, studentId: undefined }));
              }
            }}
          >
            <Picker.Item label="Select a student" value={0} />
            {students.map((student) => (
              <Picker.Item
                key={student.id}
                label={`${student.firstName} ${student.lastName}`}
                value={student.id}
              />
            ))}
          </Picker>
        </View>
        {errors.studentId ? <Text style={styles.errorText}>{errors.studentId}</Text> : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.fieldHalf]}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            value={String(formData.billYear)}
            onChangeText={(value) => {
              setFormData((prev) => ({ ...prev, billYear: Number(value) || CURRENT_YEAR }));
              if (errors.billYear) {
                setErrors((prev) => ({ ...prev, billYear: undefined }));
              }
            }}
            style={[styles.input, errors.billYear ? styles.inputError : null]}
            keyboardType="number-pad"
          />
          {errors.billYear ? <Text style={styles.errorText}>{errors.billYear}</Text> : null}
        </View>

        <View style={[styles.fieldGroup, styles.fieldHalf]}>
          <Text style={styles.label}>Month</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={formData.billMonth}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, billMonth: Number(value) }))}
            >
              {MONTHS.map((month, index) => (
                <Picker.Item key={month} label={month} value={index + 1} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={formData.amount ? String(formData.amount) : ''}
          onChangeText={(value) => {
            setFormData((prev) => ({ ...prev, amount: Number(value) || 0 }));
            if (errors.amount) {
              setErrors((prev) => ({ ...prev, amount: undefined }));
            }
          }}
          style={[styles.input, errors.amount ? styles.inputError : null]}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
        />
        {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={formData.notes ?? ''}
          onChangeText={(value) => {
            setFormData((prev) => ({ ...prev, notes: value }));
            if (errors.notes) {
              setErrors((prev) => ({ ...prev, notes: undefined }));
            }
          }}
          style={[styles.input, styles.notesInput, errors.notes ? styles.inputError : null]}
          multiline
          numberOfLines={4}
          maxLength={500}
          placeholder="Any additional notes"
          placeholderTextColor={colors.textMuted}
        />
        {errors.notes ? <Text style={styles.errorText}>{errors.notes}</Text> : null}
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Saving...' : 'Create Payment Record'}
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
  fieldHalf: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
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
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
    backgroundColor: colors.success,
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
