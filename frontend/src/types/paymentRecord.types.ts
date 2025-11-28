export interface PaymentRecord {
  id: number;
  studentId: number;
  studentName: string;
  billYear: number;
  billMonth: number;
  // Computed fields for UI
  monthName: string;
  dueDate: Date;
  isOverdue: boolean;
  // Core fields
  amount: number;
  isPaid: boolean;
  paymentDate?: Date;
  notes?: string;
}

export interface CreatePaymentRecordDto {
  studentId: number;
  billYear: number;
  billMonth: number;
  amount: number;
  notes?: string;
}

export interface UpdatePaymentStatusDto {
  isPaid: boolean;
  paymentDate?: Date;
  notes?: string;
}