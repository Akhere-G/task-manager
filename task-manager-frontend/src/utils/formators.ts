export const capitalise = (str?: string | null) =>
  str ? str[0].toUpperCase() + str.slice(1) : "";
