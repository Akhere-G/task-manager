import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const TOAST_DISMISS_MS = 5000;

interface Toast {
  id: number;
  message: string;
}

interface ToastContextType {
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)),
    [],
  );

  const showError = useCallback(
    (message: string) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { id, message }]);
      setTimeout(() => dismiss(id), TOAST_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-120 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="card flex items-center gap-2 rounded-lg border-l-4 border-l-failure text-sm text-failure"
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="cursor-pointer rounded-md p-1 hover:bg-surface-muted"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
