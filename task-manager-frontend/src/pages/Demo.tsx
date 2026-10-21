import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ErrorState, LoadingState } from "../components/ui";
import { useAuthContext } from "../context/AuthContext";

// Signs in as the shared demo user. Once authenticated, the route wrapper in App
// redirects to "/", so there is nothing to render on success.
export default function Demo() {
  const { loginAsDemo } = useAuthContext();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // React StrictMode runs effects twice in development; only start one session.
    if (started.current) return;
    started.current = true;

    loginAsDemo().catch((err) => {
      console.error(err);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.errors?.general
        : null;
      setError(message ?? "The demo could not be started.");
    });
  }, [loginAsDemo]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <ErrorState error={error} />
        <Link className="text-accent underline text-sm" to="/login">
          Back to login
        </Link>
      </div>
    );
  }

  return <LoadingState loadMessage="Setting up the demo..." />;
}
