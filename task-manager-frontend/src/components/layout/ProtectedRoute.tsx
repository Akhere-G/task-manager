import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  redirectTo = "/register",
  redirect = true,
}: {
  children: React.ReactNode;
  redirectTo?: string;
  redirect?: boolean;
}) {
  if (redirect) {
    return <Navigate to={redirectTo} />;
  }
  return children;
}
