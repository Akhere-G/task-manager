export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginUserInput = {
  email: string;
  password: string;
};

export type User = {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
};
