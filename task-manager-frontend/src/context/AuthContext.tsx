import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type {
  LoginUserInput,
  RegisterUserInput,
  User,
} from "../features/auth/types";
import { authService } from "../services/api";

interface AuthContextType {
  register: (userData: RegisterUserInput) => Promise<void>;
  login: (userDate: LoginUserInput) => Promise<void>;
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
    const checkSession = async () => {
      try {
        const response = await authService.checkSession();
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
    const { user } = await authService.register(userData);
    setUser(user);
    setIsAuthenticated(true);
  };

  const login = async ({ email, password }: LoginUserInput) => {
    const { user } = await authService.login({ email, password });
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{ login, logout, register, user, isAuthenticated, isLoading }}
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
