import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/admin/invites", label: "Invites" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/sync", label: "Match Sync" },
];

export function AdminLayout() {
  return (
    <div>
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="sm:hidden -mx-4 px-4 mb-5 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        <nav className="flex">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="sm:flex sm:gap-6">
        <aside className="hidden sm:block w-44 shrink-0">
          <nav className="flex flex-col gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
