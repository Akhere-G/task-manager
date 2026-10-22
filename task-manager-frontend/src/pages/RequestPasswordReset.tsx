import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import { authService } from "../features/auth/api";
import { trackEvent } from "../services/analytics";

export default function RequestPasswordReset() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (email: string) => {
    if (!email.trim()) {
      setError("Please enter email.");
      return false;
    } else {
      setError("");
      return true;
    }
  };

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setIsLoading(true);
    setTouched(true);
    const noErrors = validate(email);

    if (!noErrors) return setIsLoading(false);

    try {
      await authService.requestPasswordReset(email);
      trackEvent("password_reset_requested");
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          "Unable to process request. Please check your email and try again.",
        );
      } else {
        setError("Sorry, something went wrong. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card">
      <h1 className="text-3xl font-bold text-text-main">Forgot Password</h1>
      <p className="text-text-sub mt-2">
        Enter your email address and we will send you a link to reset your
        password.
      </p>

      {success ? (
        <div className="mt-6 p-4 bg-success/10 text-success rounded-md border-l-4 border-l-success">
          If an account exists for that email, you will receive a reset link
          shortly.
          <div className="mt-4">
            <Link to="/login" className="text-accent underline">
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && (
            <p className="text-failure bg-failure/10 p-3 rounded-md border-l-4 border-l-failure">
              {error}
            </p>
          )}
          <FormInput
            handleChange={(e) => {
              setEmail(e.target.value);
              validate(e.target.value);
            }}
            label="Email"
            name="email"
            value={email}
            type="email"
            touched={touched}
            handleBlur={() => setTouched(true)}
          />
          <button
            aria-label="Send reset link"
            className={
              isLoading
                ? "self-end btn-primary-disabled"
                : "self-end btn-primary"
            }
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      )}
    </div>
  );
}
