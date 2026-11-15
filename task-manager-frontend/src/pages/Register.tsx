import { getRateLimitMessage } from "../utils/errors";
import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import { Link } from "react-router-dom";
import type { RegisterUserInput } from "../features/auth/types";
import { useAuthContext } from "../context/AuthContext";
import { validateRegister } from "../features/auth/schemas";

type ErrorMesageType = { [P in keyof RegisterUserInput]: string } & {
  general: string;
};

export default function Register() {
  const [formData, setFormData] = useState({
    acceptedTerms: false,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errorMessages, setErrorMessages] = useState({
    acceptedTerms: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    general: "",
  });
  const [touched, setTouched] = useState({
    acceptedTerms: false,
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsloading] = useState(false);

  const { register } = useAuthContext();

  const validateForm = (data: typeof formData) => {
    setErrorMessages({ ...defaultErrorMessages, ...validateRegister(data) });
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
    acceptedTerms: "",
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
      acceptedTerms: true,
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    const validationErrors = validateRegister(formData);
    setErrorMessages({ ...defaultErrorMessages, ...validationErrors });
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setIsloading(true);
      await register(formData);
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
          general:
            getRateLimitMessage(err) ??
            "Unable to create account. Please try again or log in.",
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
          <div>
            <div className="flex items-start gap-3">
              <input
                id="acceptedTerms"
                name="acceptedTerms"
                type="checkbox"
                checked={formData.acceptedTerms}
                onChange={(event) => {
                  const acceptedTerms = event.target.checked;
                  const nextFormData = { ...formData, acceptedTerms };
                  setFormData(nextFormData);
                  validateForm(nextFormData);
                  setTouched((current) => ({
                    ...current,
                    acceptedTerms: true,
                  }));
                }}
                className="mt-1 h-4 w-4 accent-brand"
              />
              <label htmlFor="acceptedTerms" className="text-sm text-text-sub">
                I agree to the{" "}
                <Link className="text-link underline" to="/terms">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link className="text-link underline" to="/privacy">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {touched.acceptedTerms && errorMessages.acceptedTerms && (
              <p className="mt-2 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
                {errorMessages.acceptedTerms}
              </p>
            )}
          </div>
          <button
            aria-label="Register"
            className={
              isLoading || !formData.acceptedTerms
                ? "self-end btn-primary-disabled"
                : "self-end btn-primary"
            }
            disabled={isLoading || !formData.acceptedTerms}
          >
            Register
          </button>
        </form>
        <p className="mt-6 text-sm text-text-sub">
          Just looking around?{" "}
          <Link className="text-accent underline" to="/demo">
            Try the demo
          </Link>
        </p>
      </div>
    </div>
  );
}
