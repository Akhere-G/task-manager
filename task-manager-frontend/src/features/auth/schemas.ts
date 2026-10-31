import { z } from "zod";
import { toFieldErrors } from "../../utils/zodErrors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const required = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

const nameField = (label: string) =>
  required(`${label} is required.`).max(50, `${label} too long.`);

const passwordField = required("Password is required.")
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p),
    "Password must contain both letters and numbers.",
  );

export const loginSchema = z.object({
  email: required("Email is required."),
  password: required("Password is required."),
});

export const registerSchema = z
  .object({
    firstName: nameField("First name"),
    lastName: nameField("Last name"),
    email: required("Email is required.")
      .max(100, "Email too long.")
      .regex(EMAIL_REGEX, "Invalid email address."),
    password: passwordField,
    confirmPassword: required("Confirm password is required."),
  })
  .refine((d) => !d.confirmPassword || d.confirmPassword === d.password, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: required("Confirm password is required."),
  })
  .refine((d) => !d.confirmPassword || d.confirmPassword === d.password, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const validateLogin = (data: unknown) =>
  toFieldErrors(loginSchema.safeParse(data));
export const validateRegister = (data: unknown) =>
  toFieldErrors(registerSchema.safeParse(data));
export const validateResetPassword = (data: unknown) =>
  toFieldErrors(resetPasswordSchema.safeParse(data));
