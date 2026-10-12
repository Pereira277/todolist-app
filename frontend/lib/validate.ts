const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export const INVALID_EMAIL_MESSAGE = "Enter a valid email address, like name@example.com.";
