import { useEffect, useState } from "react";
import api from "../../api/axios";
import type { User } from "../../types";

const roleStyle = (role: string) =>
  role === "admin"
    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";

const statusStyle = (active: boolean) =>
  active
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [resetLinks, setResetLinks] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<User[]>("/admin/users", {
        params: { page: 1, page_size: 500 },
      });
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (user: User) => {
    setToggling(user.id);
    try {
      const { data } = await api.patch<User>(`/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
    } finally {
      setToggling(null);
    }
  };

  const resetPassword = async (userId: number) => {
    const { data } = await api.post<{ reset_url: string }>(`/admin/users/${userId}/reset-password`);
    setResetLinks((prev) => ({ ...prev, [userId]: data.reset_url }));
  };

  const actionBtn = "text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Users <span className="text-sm font-normal text-gray-400 dark:text-gray-500">({users.length})</span>
      </h2>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {["Name", "Email", "Role", "Status", "Joined", ""].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id} className={u.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{u.full_name}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${roleStyle(u.role)}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusStyle(u.is_active)}`}>
                        {u.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => toggleActive(u)} disabled={toggling === u.id} className={actionBtn}>
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => resetPassword(u.id)} className={actionBtn}>
                          Reset pw
                        </button>
                      </div>
                      {resetLinks[u.id] && (
                        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 break-all max-w-xs">
                          <span className="font-medium">Reset link: </span>
                          <span className="font-mono">{resetLinks[u.id]}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${u.is_active ? "" : "opacity-50"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{u.full_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${roleStyle(u.role)}`}>{u.role}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${statusStyle(u.is_active)}`}>
                        {u.is_active ? "active" : "inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(u)} disabled={toggling === u.id} className={actionBtn}>
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => resetPassword(u.id)} className={actionBtn}>
                    Reset pw
                  </button>
                </div>
                {resetLinks[u.id] && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 break-all">
                    <span className="font-medium">Reset link: </span>
                    <span className="font-mono">{resetLinks[u.id]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
