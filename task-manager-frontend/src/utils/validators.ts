export interface TaskData {
  title: string;
  description: string;
  dueDate: string;
  estimatedTime: number | string;
  category: string;
  isCompleted?: boolean;
  completedAt?: string | null;
}

export interface UserData {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  confirmPassword?: string;
}

export type ValidationErrors = Record<string, string>;

const VALID_CATEGORIES = [
  "work", "home", "chores", "life-admin", "health", 
  "self-care", "social", "hobbies", "learning", "finance", "general"
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


export const validateTask = (
  data: Partial<TaskData>, 
  isUpdate = false
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if ('title' in data || !isUpdate) {
    const title = (data.title || '').toString().trim();
    if (!title) {
      errors.title = "Title is mandatory.";
    } else if (title.length > 255) {
      errors.title = "Title must be under 255 characters.";
    }
  }

  if ('description' in data || !isUpdate) {
    const desc = (data.description || '').toString().trim();
    if (!desc) {
      errors.description = "Description is mandatory.";
    }
  }

  if ('dueDate' in data || !isUpdate) {
    const dueDate = data.dueDate;
    if (!dueDate) {
      errors.dueDate = "Due date is mandatory.";
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate) || isNaN(Date.parse(dueDate))) {
        errors.dueDate = "Invalid date.";
      }
    }
  }

  if ('estimatedTime' in data || !isUpdate) {
    const est = data.estimatedTime;
    if (est === null || est === undefined || est === "") {
      errors.estimatedTime = "Estimated time is mandatory.";
    } else {
      const numEst = Number(est);
      if (isNaN(numEst)) {
        errors.estimatedTime = "Estimated time must be a number.";
      } else if (numEst < 1) {
        errors.estimatedTime = "Estimated time must be at least 1 minute.";
      }
    }
  }

  if ('isCompleted' in data) {
    const isComp = data.isCompleted;
    if (typeof isComp !== 'boolean') {
      errors.isCompleted = "Completion status must be a boolean.";
    }

    if (isComp && !data.completedAt) {
      errors.isCompleted = "Must provide completed at date if completing task.";
    } else if (!isComp && data.completedAt) {
      errors.isCompleted = "Must provide null for completed at date if uncompleting task.";
    }
  }

  if ('completedAt' in data && isUpdate) {
    if (data.completedAt && isNaN(Date.parse(data.completedAt))) {
      errors.completedAt = "Invalid timestamp format.";
    }
  }

  if ('category' in data || !isUpdate) {
    const cat = (data.category || '').toString().trim();
    if (!cat) {
      errors.category = "Category is mandatory.";
    } else if (cat.length > 50) {
      errors.category = "Category name is too long.";
    } else if (!VALID_CATEGORIES.includes(cat)) {
      errors.category = `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`;
    }
  }

  return errors;
};

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