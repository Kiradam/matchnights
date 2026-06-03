import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

interface ToastContextValue {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((m: string) => {
    setMsg(m);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(""), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${msg ? " show" : ""}`}>
        <span className="toast-dot" />
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
