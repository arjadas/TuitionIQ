export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
};

export type PasswordValidationResult = {
  isValid: boolean;
  score: number;
  checks: PasswordChecks;
};

export function validatePassword(password: string): PasswordValidationResult {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z\d]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  return {
    isValid: PASSWORD_REGEX.test(password),
    score,
    checks,
  };
}
