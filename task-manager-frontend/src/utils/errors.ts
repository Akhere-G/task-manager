import axios from "axios";

export function getRateLimitMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 429) return null;

  const seconds = Number(err.response.headers?.["retry-after"]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Too many attempts. Please try again later.";
  }

  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
