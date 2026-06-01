import { useEffect, useState } from "react";
import api from "../../api/axios";
import type { Group, GroupMember, User } from "../../types";

function GroupDetail({ group, onClose }: { group: Group; onClose: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadMembers = async () => {
    const { data } = await api.get<GroupMember[]>(`/admin/groups/${group.id}/members`);
    setMembers(data);
  };

  useEffect(() => {
    Promise.all([
      api.get<User[]>("/admin/users", { params: { page: 1, page_size: 500 } }),
      api.get<GroupMember[]>(`/admin/groups/${group.id}/members`),
    ]).then(([usersRes, membersRes]) => {
      setAllUsers(usersRes.data);
      setMembers(membersRes.data);
    }).finally(() => setLoading(false));
  }, [group.id]);

  const addMember = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await api.post(`/admin/groups/${group.id}/members`, { user_id: Number(selectedUserId) });
      await loadMembers();
      setSelectedUserId("");
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: number) => {
    await api.delete(`/admin/groups/${group.id}/members/${userId}`);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const memberIds = new Set(members.map((m) => m.user_id));
  const eligibleUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{group.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <option value="">Add a user…</option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
            <button
              onClick={addMember}
              disabled={!selectedUserId || adding}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-gray-400">No members yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.full_name}</div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </div>
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selected, setSelected] = useState<Group | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Group[]>("/admin/groups", {
        params: { page: 1, page_size: 500 },
      });
      setGroups(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/admin/groups", { name: newName.trim(), description: newDesc.trim() || null });
      setNewName("");
      setNewDesc("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm("Delete this group? Members will lose group visibility.")) return;
    await api.delete(`/admin/groups/${id}`);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Groups <span className="text-sm font-normal text-gray-400">({groups.length})</span>
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Group name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Friends, Office"
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-sm text-gray-400">No groups yet.</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{g.name}</div>
                {g.description && <div className="text-xs text-gray-500">{g.description}</div>}
                <div className="text-xs text-gray-400 mt-0.5">
                  {g.member_count} member{g.member_count !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => setSelected(g)}
                className="text-xs px-3 py-1 border rounded hover:bg-gray-50"
              >
                Manage members
              </button>
              <button
                onClick={() => deleteGroup(g.id)}
                className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <GroupDetail
          group={selected}
          onClose={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
