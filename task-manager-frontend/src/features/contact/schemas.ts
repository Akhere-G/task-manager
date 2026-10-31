import { z } from "zod";
import { toFieldErrors } from "../../utils/zodErrors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const contactSchema = z.object({
  fullName: z
    .string({ error: "Full name is required." })
    .trim()
    .min(1, "Full name is required.")
    .max(100, "Name must be under 100 characters."),
  email: z
    .string({ error: "Email address is required." })
    .trim()
    .min(1, "Email address is required.")
    .regex(EMAIL_REGEX, "Please enter a valid email address."),
  subject: z
    .string({ error: "Please select a subject." })
    .trim()
    .min(1, "Please select a subject.")
    .max(100, "Subject too long."),
  message: z
    .string({ error: "Message content is required." })
    .trim()
    .min(1, "Message content is required.")
    .min(10, "Message must be at least 10 characters.")
    .max(2000, "Message exceeds 2000 characters."),
});

export const validateContact = (data: unknown) =>
  toFieldErrors(contactSchema.safeParse(data));
