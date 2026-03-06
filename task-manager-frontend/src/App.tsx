import { Route, Routes, useLocation } from "react-router-dom";
import {
  About,
  AddTask,
  Contact,
  Home,
  Stats,
  Pomodoro,
  CalendarView,
  Register,
  Login,
  DecomposeTask,
} from "./pages";
import {
  ErrorBoundary,
  Footer,
  Header,
  ProtectedRoute,
} from "./components/layout";
import { useAuthContext } from "./context/AuthContext";

function App() {
  const { isAuthenticated, logout } = useAuthContext();
  const location = useLocation();

  const protectedRoutes = [
    { title: "Tasks", path: "/" },
    { title: "Add Task", path: "/addtask" },
    { title: "Calendar", path: "/calendar" },
    { title: "Stats", path: "/stats" },
  ];

  const loggedOutRoutes = [
    { title: "Register", path: "/register" },
    { title: "Login", path: "/login" },
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

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header
        links={navLinks}
        currentPath={location.pathname}
        logout={logout}
        isAuthenticated={isAuthenticated}
      />
      <main className="grow max-w-7xl mx-auto w-full px-3 py-3 md:px-12 md:py-12">
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
