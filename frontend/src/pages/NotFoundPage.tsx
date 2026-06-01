import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-gray-200">404</p>
        <p className="mt-4 text-gray-700 font-medium">Page not found</p>
        <Link
          to="/matches"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Go to matches
        </Link>
      </div>
    </div>
  );
}
