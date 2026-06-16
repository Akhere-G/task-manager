import { useState } from "react";
import { FormInput } from "../components/ui";
import { useSearchParams, useNavigate } from "react-router-dom";
import { validateUser } from "../utils/validators";
import axios from "axios";
import { authService } from "../features/auth/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [errorMessages, setErrorMessages] = useState({
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validateForm = (data: typeof formData) => {
    const validationErrors = validateUser(
      { ...data, email: "placeholder@test.com", firstName: "A", lastName: "B" },
      true,
    );
    setErrorMessages({
      password: validationErrors.password || "",
      confirmPassword: validationErrors.confirmPassword || "",
    });

    return (
      Boolean(validationErrors.password) ||
      Boolean(validationErrors.confirmPassword)
    );
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

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    const hasErrors = validateForm(formData);

    if (hasErrors) return;

    if (!token) return setServerError("Invalid or missing reset token.");

    setIsLoading(true);
    setServerError("");

    try {
      await authService.resetPassword(token, formData.password);
      navigate("/login", {
        state: { message: "Password updated successfully!" },
      });
    } catch (err) {
      console.error(err);
      if (!axios.isAxiosError(err)) {
        return;
      } else if (err.status === 400) {
        const passwordError: string = err.response?.data?.errors?.password;
        setErrorMessages({
          password: passwordError || "",
          confirmPassword: "",
        });
        if (!passwordError) {
          setServerError(
            "Failed to reset password. The link may have expired or is invalid.",
          );
        }
      } else {
        setServerError(
          "Failed to reset password. Sorry, something went wrong...",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card">
      <h1 className="text-3xl font-bold text-text-main">Set New Password</h1>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {serverError && (
          <p className="text-failure bg-failure/10 p-3 rounded-md border-l-4 border-l-failure">
            {serverError}
          </p>
        )}
        <FormInput
          label="New Password"
          name="password"
          type="password"
          value={formData.password}
          errorMessage={errorMessages.password}
          touched={touched.password}
          handleChange={handleChange}
          handleBlur={handleBlur}
        />
        <FormInput
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          errorMessage={errorMessages.confirmPassword}
          touched={touched.confirmPassword}
          handleChange={handleChange}
          handleBlur={handleBlur}
        />
        <button
          aria-label="Update password"
          className={isLoading ? "btn-primary-disabled" : "btn-primary"}
          disabled={isLoading}
        >
          {isLoading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
