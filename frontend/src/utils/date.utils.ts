import { MONTHS } from '@/constants/config';

/**
 * Formats a date for display.
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

/**
 * Gets the month name from a 1-indexed month number.
 */
export const getMonthName = (month: number): string => {
  return MONTHS[month - 1] || '';
};