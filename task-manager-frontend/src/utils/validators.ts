import type { Task } from "../features/tasks/types";

export interface TaskData {
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  category: string;
  isCompleted?: boolean;
  completedAt?: string | null;
  repeatUntil?: string | null;
  isRepeating?: boolean | null;
  repeatBy?: string | null;
}

export interface ContactData {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

export interface UserData {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  confirmPassword?: string;
}

export type TaskError = { [P in keyof Task]: string };
export type ContactError = { [P in keyof ContactData]: string };
export type UserError = { [P in keyof UserData]: string };

const VALID_CATEGORIES = [
  "work",
  "home",
  "chores",
  "life-admin",
  "health",
  "self-care",
  "social",
  "hobbies",
  "learning",
  "finance",
  "general",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateTask = (data: Partial<TaskData>, isUpdate = false) => {
  const errors: Partial<TaskError> = {};

  if ("title" in data || !isUpdate) {
    const title = (data.title || "").toString().trim();
    if (!title) {
      errors.title = "Title is mandatory.";
    } else if (title.length > 255) {
      errors.title = "Title must be under 255 characters.";
    }
  }

  if ("starAt" in data || !isUpdate) {
    const startAt = data.startAt;
    if (!startAt) {
      errors.startAt = "Start At is mandatory.";
    } else {
      if (isNaN(Date.parse(startAt))) {
        errors.startAt = "Invalid date format for Start At.";
      }
    }
  }

  if ("endAt" in data || !isUpdate) {
    const endAt = data.endAt;
    if (!endAt) {
      errors.endAt = "End At is mandatory.";
    } else {
      if (isNaN(Date.parse(endAt))) {
        errors.endAt = "Invalid date format for End At.";
      }
    }
  }

  if (data.startAt && data.endAt) {
    const end = Date.parse(data.endAt);
    const start = Date.parse(data.startAt);

    if (end <= start) {
      errors.endAt = "End At must be after start at.";
    }
  }

  if ("isCompleted" in data) {
    const isComp = data.isCompleted;
    if (typeof isComp !== "boolean") {
      errors.isCompleted = "Completion status must be a boolean.";
    }

    if (isComp && !data.completedAt) {
      errors.isCompleted = "Must provide completed at date if completing task.";
    } else if (!isComp && data.completedAt) {
      errors.isCompleted =
        "Must provide null for completed at date if uncompleting task.";
    }
  }

  if ("completedAt" in data || !isUpdate) {
    if (data.completedAt && isNaN(Date.parse(data.completedAt))) {
      errors.completedAt = "Invalid timestamp format.";
    }
  }

  if ("category" in data || !isUpdate) {
    const cat = (data.category || "").toString().trim();
    if (!cat) {
      errors.category = "Category is mandatory.";
    } else if (cat.length > 50) {
      errors.category = "Category name is too long.";
    } else if (!VALID_CATEGORIES.includes(cat)) {
      errors.category = `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`;
    }
  }

  if (data.isRepeating) {
    const isRepeating = data.isRepeating;
    if (typeof isRepeating !== "boolean") {
      errors["isRepeating"] = "isRepeating must be a boolean (true/false).";
    }
    if (!("repeatBy" in data)) {
      errors["repeatBy"] = "Repeat By is required for repeating tasks.";
    }
  }
  if ("repeatBy" in data && typeof data.repeatBy === "string") {
    const repeatBy = data.repeatBy;
    if (!["daily", "weekly", "monthly", "yearly"].includes(repeatBy)) {
      errors["repeatBy"] =
        "Repeat should must only be daily, weekly, monthly or yearly.";
    }
  }
  if (
    "repeatUntil" in data &&
    typeof data.repeatUntil === "string" &&
    isNaN(Date.parse(data.repeatUntil))
  ) {
    errors["repeatUntil"] = "Invalid timestamp. Use YYYY-MM-DD format.";
  }

  return errors;
};

export const validateTaskList = (tasks: TaskData[]) => {
  const allErrors: Partial<TaskError>[] = [];
  let hasErrors = false;
  for (const task of tasks) {
    const errors = validateTask(task);
    allErrors.push(errors);
    hasErrors = hasErrors || Object.values(errors).some((err) => err !== "");
  }

  return { hasErrors, allErrors };
};

export const validateContactRequest = (
  data: ContactData,
): Partial<ContactError> => {
  const errors: Partial<ContactError> = {};

  const fullName = (data.fullName || "").trim();
  if (!fullName) errors.fullName = "Full name is required.";
  else if (fullName.length > 100)
    errors.fullName = "Name must be under 100 characters.";

  const email = (data.email || "").trim();
  if (!email) errors.email = "Email address is required.";
  else if (!EMAIL_REGEX.test(email))
    errors.email = "Please enter a valid email address.";

  const subject = (data.subject || "").trim();
  if (!subject) errors.subject = "Please select a subject.";
  else if (subject.length > 100) errors.subject = "Subject too long.";

  const message = (data.message || "").trim();
  if (!message) errors.message = "Message content is required.";
  else if (message.length < 10)
    errors.message = "Message must be at least 10 characters.";
  else if (message.length > 2000)
    errors.message = "Message exceeds 2000 characters.";

  return errors;
};

export const validateUser = (data: UserData, isRegistering = false) => {
  const errors: Partial<UserError> = {};
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
  else if (email && !EMAIL_REGEX.test(email))
    errors.email = "Invalid email address.";

  if (password) {
    if (password.length < 8)
      errors.password = "Password must be at least 8 characters.";
    else if (!(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
      errors.password = "Password must contain both letters and numbers.";
    }
  }

  const confirmPassword = getClean(data.confirmPassword);
  if (!confirmPassword)
    errors.confirmPassword = "Confirm password is required.";
  else if (confirmPassword !== password)
    errors.confirmPassword = "Passwords do not match.";

  return errors;
};
