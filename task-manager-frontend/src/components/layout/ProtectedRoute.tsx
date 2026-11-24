import { Navigate, useLocation } from "react-router-dom";

const readFrom = (state: unknown) =>
  typeof state === "object" &&
  state !== null &&
  "from" in state &&
  typeof state.from === "string"
    ? state.from
    : null;

export default function ProtectedRoute({
  children,
  redirectTo = "/login",
  redirect = true,
}: {
  children: React.ReactNode;
  redirectTo?: string;
  redirect?: boolean;
}) {
  const location = useLocation();

  if (redirect) {
    const from = location.pathname + location.search + location.hash;
    return (
      <Navigate
        to={readFrom(location.state) ?? redirectTo}
        replace
        state={{ from }}
      />
    );
  }
  return children;
}
