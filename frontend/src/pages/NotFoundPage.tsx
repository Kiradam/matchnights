import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-gray-200 dark:text-gray-800">404</p>
        <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">{t("notFound.title")}</p>
        <Link
          to="/matches"
          className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t("notFound.goToMatches")}
        </Link>
      </div>
    </div>
  );
}
