import { Navigate, useLocation } from "react-router-dom";

const LOGIN_PATH = "/login";

const readFrom = (state: unknown) =>
  typeof state === "object" &&
  state !== null &&
  "from" in state &&
  typeof state.from === "string"
    ? state.from
    : null;

export default function ProtectedRoute({
  children,
  redirectTo = LOGIN_PATH,
  redirect = true,
}: {
  children: React.ReactNode;
  redirectTo?: string;
  redirect?: boolean;
}) {
  const location = useLocation();

  if (redirect) {
    if (redirectTo === LOGIN_PATH) {
      const from = location.pathname + location.search + location.hash;
      return <Navigate to={redirectTo} replace state={{ from }} />;
    }
    return <Navigate to={readFrom(location.state) ?? redirectTo} replace />;
  }
  return children;
}
