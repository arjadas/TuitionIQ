import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { usePaymentRecords } from '@/hooks/usePaymentRecords';
import { useStudents } from '@/hooks/useStudents';
import type { CreatePaymentRecordDto, CreateStudentDto, UpdateStudentDto } from '@/types';

interface AppDataContextValue {
  students: ReturnType<typeof useStudents>['students'];
  paymentRecords: ReturnType<typeof usePaymentRecords>['paymentRecords'];
  studentsLoading: boolean;
  paymentRecordsLoading: boolean;
  loading: boolean;
  error: string | null;
  createStudent: (data: CreateStudentDto) => Promise<boolean>;
  updateStudent: (id: number, data: UpdateStudentDto) => Promise<boolean>;
  deleteStudent: (id: number) => Promise<boolean>;
  createPaymentRecord: (data: CreatePaymentRecordDto) => Promise<boolean>;
  togglePaymentStatus: (id: number, currentStatus: boolean) => Promise<boolean>;
  refreshAll: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const studentsState = useStudents();
  const paymentRecordsState = usePaymentRecords();

  const refreshAll = async () => {
    await Promise.all([studentsState.fetchStudents(), paymentRecordsState.fetchPaymentRecords()]);
  };

  const value = useMemo<AppDataContextValue>(
    () => ({
      students: studentsState.students,
      paymentRecords: paymentRecordsState.paymentRecords,
      studentsLoading: studentsState.loading,
      paymentRecordsLoading: paymentRecordsState.loading,
      loading: studentsState.loading || paymentRecordsState.loading,
      error: studentsState.error ?? paymentRecordsState.error,
      createStudent: studentsState.createStudent,
      updateStudent: studentsState.updateStudent,
      deleteStudent: studentsState.deleteStudent,
      createPaymentRecord: paymentRecordsState.createPaymentRecord,
      togglePaymentStatus: paymentRecordsState.togglePaymentStatus,
      refreshAll,
    }),
    [studentsState, paymentRecordsState]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
};
