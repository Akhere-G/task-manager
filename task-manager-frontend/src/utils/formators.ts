import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const capitalise = (str?: string | null) =>
  str ? str[0].toUpperCase() + str.slice(1) : "";

export const toFormattedUTCDate = (value: string | Date) => {
  const localDate = new Date(value);
  return formatInTimeZone(localDate, "UTC", "yyyy-MM-dd HH:mm:ss");
};

export const formatForInput = (utcDateStr: string | Date) => {
  return format(new Date(utcDateStr), "yyyy-MM-dd'T'HH:mm");
};
