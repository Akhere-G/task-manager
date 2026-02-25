import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import type { RegisterUserInput } from "../features/auth/types";
import { authService } from "../services/api";
import { useAuthContext } from "../context/AuthContext";
import { validateUser, type UserData } from "../utils/validators";

type ErrorMesageType = { [P in keyof RegisterUserInput]: string } & {
  general: string;
};

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errorMessages, setErrorMessages] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    general: "",
  });
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsloading] = useState(false);

  const { login } = useAuthContext();

  const validateForm = (data: UserData) => {
    setErrorMessages({ ...defaultErrorMessages, ...validateUser(data, true) });
  };

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    validateForm(newFormData);
  }

  function handleBlur(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  const defaultErrorMessages = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    general: "",
  };

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (
      Object.entries(errorMessages).some(
        ([k, v]) => v !== "" && k !== "general",
      )
    )
      return;

    try {
      setIsloading(true);
      const { token } = await authService.register(formData);
      login(token);
    } catch (err) {
      console.error(err);
      if (!axios.isAxiosError(err)) {
        return;
      }
      if (err.status === 400) {
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages({ ...defaultErrorMessages, ...errors });
      } else {
        setErrorMessages({
          ...errorMessages,
          general: "Unable to create account. Please try again or log in.",
        });
      }
    } finally {
      setIsloading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h1 className="text-3xl font-bold text-text-main transition-colors">
          Register
        </h1>
        <p className="text-text-sub">Start managing your productivity today</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {errorMessages.general && (
            <p className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
              {errorMessages.general}
            </p>
          )}
          <FormInput
            handleChange={handleChange}
            label="First Name"
            name="firstName"
            value={formData.firstName}
            errorMessage={errorMessages.firstName}
            touched={touched.firstName}
            handleBlur={handleBlur}
          />
          <FormInput
            handleChange={handleChange}
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            errorMessage={errorMessages.lastName}
            touched={touched.lastName}
            handleBlur={handleBlur}
          />
          <FormInput
            handleChange={handleChange}
            label="Email"
            name="email"
            value={formData.email}
            errorMessage={errorMessages.email}
            type="email"
            touched={touched.email}
            handleBlur={handleBlur}
          />
          <FormInput
            handleChange={handleChange}
            label="Password"
            name="password"
            value={formData.password}
            errorMessage={errorMessages.password}
            type="password"
            touched={touched.password}
            handleBlur={handleBlur}
          />
          <FormInput
            handleChange={handleChange}
            label="Confirm Password"
            name="confirmPassword"
            value={formData.confirmPassword}
            errorMessage={errorMessages.confirmPassword}
            type="password"
            touched={touched.confirmPassword}
            handleBlur={handleBlur}
          />
          <button
            className={
              isLoading
                ? "self-end btn-primary-disabled"
                : "self-end btn-primary"
            }
            disabled={isLoading}
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
}
