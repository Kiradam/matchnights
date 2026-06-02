export function MatchCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mb-2" />
      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-4" />
      <div className="flex gap-2">
        {[0, 1, 2].map((j) => (
          <div key={j} className="flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}
