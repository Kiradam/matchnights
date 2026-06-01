import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/admin/invites", label: "Invites" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/sync", label: "Match Sync" },
];

export function AdminLayout() {
  return (
    <div className="flex gap-6">
      <aside className="w-44 shrink-0">
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
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
  );
}
