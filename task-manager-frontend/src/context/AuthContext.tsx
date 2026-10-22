import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type {
  LoginUserInput,
  RegisterUserInput,
  User,
} from "../features/auth/types";
import { authService } from "../features/auth/api";
import {
  endAnalyticsSession,
  getErrorType,
  hasAnalyticsSession,
  startAnalyticsSession,
  trackEvent,
} from "../services/analytics";
import { setSessionExpiredHandler } from "../services/api";

interface AuthContextType {
  register: (userData: RegisterUserInput) => Promise<void>;
  login: (userDate: LoginUserInput) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export default function AuthContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (hasAnalyticsSession()) {
        trackEvent("session_expired", undefined, { beacon: true });
        endAnalyticsSession();
      }
      setUser(null);
      setIsAuthenticated(false);
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await authService.checkSession();
        startAnalyticsSession(response.user);
        setUser(response.user);
        setIsAuthenticated(true);
      } catch (err) {
        console.error(err);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const register = async (userData: RegisterUserInput) => {
    try {
      const { user } = await authService.register(userData);
      startAnalyticsSession(user);
      trackEvent("register");
      setUser(user);
      setIsAuthenticated(true);
    } catch (err) {
      trackEvent("register_failed", { error_type: getErrorType(err) });
      throw err;
    }
  };

  const login = async ({ email, password }: LoginUserInput) => {
    try {
      const { user } = await authService.login({ email, password });
      startAnalyticsSession(user);
      trackEvent("login");
      setUser(user);
      setIsAuthenticated(true);
    } catch (err) {
      trackEvent("login_failed", { error_type: getErrorType(err) });
      throw err;
    }
  };

  const loginAsDemo = async () => {
    const { user } = await authService.demoLogin();
    startAnalyticsSession(user);
    trackEvent("demo_started");
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await authService.logout();
    trackEvent(user?.isDemo ? "demo_exited" : "logout");
    endAnalyticsSession();
    setUser(null);
    setIsAuthenticated(false);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        login,
        loginAsDemo,
        logout,
        register,
        user,
        isAuthenticated,
        isLoading,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within a AuthContextProvider");
  }
  return context;
};
