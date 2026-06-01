import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../api/axios";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<User>("/users/me");
      setUser(data);
    } catch {
      setUser(null);
      sessionStorage.removeItem("access_token");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to restore session on page load via refresh token cookie
    api
      .post<{ access_token: string }>("/auth/refresh")
      .then(({ data }) => {
        sessionStorage.setItem("access_token", data.access_token);
        return fetchMe();
      })
      .catch(() => setIsLoading(false));
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ access_token: string }>("/auth/login", {
        email,
        password,
      });
      sessionStorage.setItem("access_token", data.access_token);
      await fetchMe();
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    sessionStorage.removeItem("access_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
