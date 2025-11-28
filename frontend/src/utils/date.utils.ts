export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

export const getMonthName = (month: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
};

export const isOverdue = (dueDate: Date | string, isPaid: boolean): boolean => {
  if (isPaid) return false;
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return dueDateObj < new Date();
};