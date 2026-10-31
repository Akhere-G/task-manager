import type { ZodError } from "zod";

type Result = { success: true } | { success: false; error: ZodError };

/** Collapses a zod result into `{ field: firstMessage }` for form error state. */
export const toFieldErrors = (result: Result): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "general");
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
};
