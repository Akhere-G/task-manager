import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import TaskContextProvider from "./context/TaskContext.tsx";
import AuthProvider from "./context/AuthContext.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./features/users/ThemeContext.tsx";

const root = document.getElementById("root") || document.body;

const queryClient = new QueryClient();

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TaskContextProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </TaskContextProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
