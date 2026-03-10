import { format, isSameDay, isSameYear } from "date-fns";

export const formatDate = (dateStr?: string) => {
  const date = dateStr ? new Date(dateStr) : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const formatDateRange = (startAt: string, endAt: string) => {
  const endDate = new Date(endAt);
  const startDate = new Date(startAt);
  const sameDay = isSameDay(endDate, startDate);
  const sameYear = isSameYear(endDate, startDate);
  const isToday = isSameDay(startAt, new Date());

  let dateStr = "";

  const year = !isSameYear(startDate, new Date()) || !sameYear ? " yy" : "";

  if (isToday && sameDay) {
    dateStr = `${format(new Date(startAt), `HH:mm`)} - ${format(new Date(endAt), "HH:mm")}`;
  } else if (sameDay) {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "HH:mm")}`;
  } else if (sameYear) {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "d LLL, HH:mm")}`;
  } else {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "d LLL, yy HH:mm")}`;
  }

  return dateStr;
};
