import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";

const inputCls =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

export function RegisterPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { login } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-700 dark:text-gray-300 font-medium">{t("register.invalidInvite")}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("register.askAdmin")}</p>
        </div>
      </div>
    );
  }

  const usernameValid = /^[A-Za-z0-9]+$/.test(fullName);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameValid) {
      setError(t("register.usernameError"));
      return;
    }
    if (password !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", { token, full_name: fullName, email, password });
      await login(email, password);
      navigate("/matches", { replace: true });
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { detail?: string } } })?.response;
      if (res?.status === 400 || res?.status === 410) setError(t("register.inviteExpired"));
      else if (res?.status === 409) {
        const detail = res.data?.detail ?? "";
        if (detail.toLowerCase().includes("username")) setError(t("register.usernameTaken"));
        else setError(t("register.emailTaken"));
      } else {
        setError(t("register.genericError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t("register.title")}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("register.username")}</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
              autoComplete="username"
            />
            {fullName && !usernameValid && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{t("register.usernameHint")}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("register.email")}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("register.password")}</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("register.confirmPassword")}</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 dark:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? t("register.creating") : t("register.create")}
          </button>
        </form>
      </div>
    </div>
  );
}
