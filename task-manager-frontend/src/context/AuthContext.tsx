import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  token: string | null; 
  login: (newToken: string) => void; 
  logout: () => void; 
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType| null>(null)

export default function AuthContextProvider ({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))

  useEffect(() => {
    const savedToken = localStorage.getItem("token");

    if (savedToken) {
      setToken(savedToken);
    }
    
  }, []);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
    )
}


export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context){
    throw new Error("useAuthContext must be used within a AuthContextProvider");
  }
  return context
}