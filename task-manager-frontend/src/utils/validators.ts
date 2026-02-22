export interface UserData {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  confirmPassword?: string;
}

export type ValidationErrors = Record<string, string>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateUser = (
  data: UserData, 
  isRegistering = false
): ValidationErrors => {
  const errors: ValidationErrors = {};
  const getClean = (val?: string) => (val || "").toString().trim();

  const email = getClean(data.email);
  const password = getClean(data.password);

  if (!email) errors.email = "Email is required.";
  if (!password) errors.password = "Password is required.";

  if (!isRegistering) return errors;

  const firstName = getClean(data.firstName);
  const lastName = getClean(data.lastName);

  if (!firstName) errors.firstName = "First name is required.";
  else if (firstName.length > 50) errors.firstName = "First name too long.";

  if (!lastName) errors.lastName = "Last name is required.";
  else if (lastName.length > 50) errors.lastName = "Last name too long.";

  if (email && email.length > 100) errors.email = "Email too long.";
  else if (email && !EMAIL_REGEX.test(email)) errors.email = "Invalid email address.";

  if (password) {
    if (password.length < 8) errors.password = "Password must be at least 8 characters.";
    else if (!(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
      errors.password = "Password must contain both letters and numbers.";
    }
  }

  const confirmPassword = getClean(data.confirmPassword);
  if (!confirmPassword) errors.confirmPassword = "Confirm password is required.";
  else if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match.";

  return errors;
};