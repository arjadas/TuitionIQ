import { useState } from 'react';
import { Users, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/common/StatCard';
import { TabButton } from '@/components/common/TabButton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Dashboard } from '@/pages/Dashboard';
import { StudentsPage } from '@/pages/StudentsPage';
import { PaymentRecordsPage } from '@/pages/PaymentsPage';
import { StudentForm } from '@/components/students/StudentForm';
import { PaymentRecordForm } from '@/components/payments/PaymentForm';
import { useStudents } from '@/hooks/useStudents';
import { usePaymentRecords } from '@/hooks/usePaymentRecords';
import { CURRENT_YEAR, CURRENT_MONTH } from '@/constants/config';
import { formatCurrency } from '@/utils/currency.utils';
import type { PaymentRecord, CreatePaymentRecordDto } from '@/types';

type TabType = 'dashboard' | 'students' | 'payments';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const {
    students,
    loading: studentsLoading,
    createStudent,
    updateStudent,
    deleteStudent,
  } = useStudents();

  const { 
    paymentRecords, 
    loading: paymentRecordsLoading, 
    createPaymentRecord, 
    togglePaymentStatus 
  } = usePaymentRecords();

  const loading = studentsLoading || paymentRecordsLoading;

  // Calculate statistics
  const overduePaymentRecords = paymentRecords.filter((p: PaymentRecord) => p.isOverdue);
  const totalOwed = paymentRecords.filter((p: PaymentRecord) => !p.isPaid).reduce((sum: number, p: PaymentRecord) => sum + p.amount, 0);
  const thisMonthPaymentRecords = paymentRecords.filter(
    (p: PaymentRecord) => p.billMonth === CURRENT_MONTH && p.billYear === CURRENT_YEAR
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onAddStudent={() => setShowStudentForm(true)}
        onAddPayment={() => setShowPaymentForm(true)}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Users className="text-blue-600" />}
            label="Total Students"
            value={students.length}
            color="blue"
          />
          <StatCard
            icon={<DollarSign className="text-green-600" />}
            label="Total Outstanding"
            value={formatCurrency(totalOwed)}
            color="green"
          />
          <StatCard
            icon={<AlertCircle className="text-red-600" />}
            label="Overdue Payments"
            value={overduePaymentRecords.length}
            color="red"
          />
          <StatCard
            icon={<Calendar className="text-purple-600" />}
            label="This Month"
            value={thisMonthPaymentRecords.length}
            color="purple"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex">
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                label="Dashboard"
              />
              <TabButton
                active={activeTab === 'students'}
                onClick={() => setActiveTab('students')}
                label="Students"
              />
              <TabButton
                active={activeTab === 'payments'}
                onClick={() => setActiveTab('payments')}
                label="Payments"
              />
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'dashboard' && (
              <Dashboard paymentRecords={paymentRecords} onTogglePaymentRecord={togglePaymentStatus} />
            )}
            {activeTab === 'students' && (
              <StudentsPage
                students={students}
                onCreateStudent={createStudent}
                onUpdateStudent={updateStudent}
                onDeleteStudent={deleteStudent}
              />
            )}
            {activeTab === 'payments' && (
              <PaymentRecordsPage paymentRecords={paymentRecords} onTogglePaymentRecord={togglePaymentStatus} />
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showStudentForm && (
        <StudentForm
          onClose={() => setShowStudentForm(false)}
          onSubmit={async (data) => {
            const success = await createStudent(data);
            if (success) setShowStudentForm(false);
            return success;
          }}
        />
      )}

      {showPaymentForm && (
        <PaymentRecordForm
          students={students}
          onClose={() => setShowPaymentForm(false)}
          onSubmit={async (data: CreatePaymentRecordDto) => {
            const success = await createPaymentRecord(data);
            if (success) setShowPaymentForm(false);
            return success;
          }}
        />
      )}
    </div>
  );
}

export default App;