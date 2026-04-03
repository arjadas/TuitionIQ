import { MONTHS } from '@/constants/config';

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

export const getMonthName = (month: number): string => {
  return MONTHS[month - 1] ?? '';
};
