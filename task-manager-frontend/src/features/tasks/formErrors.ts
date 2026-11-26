import axios from "axios";

import type { CreateTaskInput } from "./types";

export type FormErrors = Partial<
  Record<keyof CreateTaskInput | "general", string>
>;

export const formErrorsFrom = (error: unknown): FormErrors => {
  if (!axios.isAxiosError(error)) return {};
  if (error.status === 400) return error.response?.data?.errors ?? {};
  return { general: "Could not send data" };
};
