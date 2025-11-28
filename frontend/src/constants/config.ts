export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const ENDPOINTS = {
  STUDENTS: '/students',
  PAYMENT_RECORDS: '/paymentrecords',
} as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth() + 1;