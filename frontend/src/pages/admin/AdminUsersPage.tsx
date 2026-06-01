import { useEffect, useState } from "react";
import api from "../../api/axios";
import type { User } from "../../types";

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
    const { data } = await api.post<{ reset_url: string }>(
      `/admin/users/${userId}/reset-password`
    );
    setResetLinks((prev) => ({ ...prev, [userId]: data.reset_url }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Users <span className="text-sm font-normal text-gray-400">({users.length})</span>
      </h2>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Role</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Joined</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={u.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-2 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {u.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={toggling === u.id}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40"
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => resetPassword(u.id)}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                      >
                        Reset pw
                      </button>
                    </div>
                    {resetLinks[u.id] && (
                      <div className="mt-1 text-xs text-blue-600 break-all max-w-xs">
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
      )}
    </div>
  );
}
