import { lazy } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import {
  DemoBanner,
  ErrorBoundary,
  Footer,
  Header,
  ProtectedRoute,
} from "./components/layout";
import { useAuthContext } from "./context/AuthContext";
import { useTheme } from "./features/users/ThemeContext";
import NotificationsPrompt from "./features/notifications/components/NotificationsPrompt";
import usePageViewTracking from "./hooks/usePageViewTracking";

const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const RequestPasswordReset = lazy(() => import("./pages/RequestPasswordReset"));
const DecomposeTask = lazy(() => import("./pages/DecomposeTask"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Demo = lazy(() => import("./pages/Demo"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const Pomodoro = lazy(() => import("./pages/Pomodoro"));
const Stats = lazy(() => import("./pages/Stats"));
const Home = lazy(() => import("./pages/Home"));
const Contact = lazy(() => import("./pages/Contact"));
const AddTask = lazy(() => import("./pages/AddTask"));
const About = lazy(() => import("./pages/About"));

function App() {
  const { isAuthenticated, logout, user } = useAuthContext();
  const isDemo = Boolean(user?.isDemo);
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  usePageViewTracking();

  const protectedRoutes = [
    { title: "Tasks", path: "/" },
    { title: "Add Task", path: "/addtask" },
    {
      title: "Calendar",
      path: "/calendar?due_date=calendar_view",
    },
    { title: "Stats", path: "/stats" },
  ];

  const loggedOutRoutes = [
    { title: "Register", path: "/register" },
    { title: "Login", path: "/login" },
    { title: "Try demo", path: "/demo" },
  ];

  const allAccessRoutes = [
    { title: "About", path: "/about" },
    { title: "Contact", path: "/contact" },
  ];

  const navLinks = [...allAccessRoutes];
  if (isAuthenticated) {
    navLinks.unshift(...protectedRoutes);
  } else {
    navLinks.unshift(...loggedOutRoutes);
  }

  const accountLinks = [{ title: "Settings", path: "/settings" }];

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header
        accountLinks={accountLinks}
        links={navLinks}
        currentPath={location.pathname}
        logout={logout}
        isAuthenticated={isAuthenticated}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
      {isDemo && <DemoBanner onExit={logout} />}
      {isAuthenticated && !isDemo && <NotificationsPrompt />}
      <main className="grow max-w-7xl mx-auto w-full px-0 py-3 md:px-8 md:py-6">
        <ErrorBoundary onRetry={() => window.location.reload()}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/addtask"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <AddTask />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <CalendarView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <Stats />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pomodoro/:taskId"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <Pomodoro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/breakdown/:taskId"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <DecomposeTask />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute redirect={!isAuthenticated}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/register"
              element={
                <ProtectedRoute redirect={isAuthenticated} redirectTo="/">
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={
                <ProtectedRoute redirect={isAuthenticated} redirectTo="/">
                  <Login />
                </ProtectedRoute>
              }
            />
            <Route
              path="/demo"
              element={
                <ProtectedRoute redirect={isAuthenticated} redirectTo="/">
                  <Demo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login/request-password-reset"
              element={
                <ProtectedRoute redirect={isAuthenticated} redirectTo="/">
                  <RequestPasswordReset />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <ProtectedRoute redirect={isAuthenticated} redirectTo="/">
                  <ResetPassword />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={<div className="text-center py-20">Page Not Found</div>}
            />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

export default App;
