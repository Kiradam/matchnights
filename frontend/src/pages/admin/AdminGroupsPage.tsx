import { useEffect, useState } from "react";
import api from "../../api/axios";
import { ConfirmModal } from "../../components/ConfirmModal";
import type { Group, GroupMember, User } from "../../types";

const inputCls = "w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";

interface RemoveConfirm {
  userId: number;
  name: string;
}

function GroupDetail({ group, onClose }: { group: Group; onClose: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirm | null>(null);

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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none w-8 h-8 flex items-center justify-center">
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="flex gap-2 mb-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-0"
            >
              <option value="">Add a user…</option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
            <button
              onClick={addMember}
              disabled={!selectedUserId || adding}
              className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded disabled:opacity-40 shrink-0"
            >
              Add
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500">No members yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.full_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</div>
                  </div>
                  <button
                    onClick={() => setRemoveConfirm({ userId: m.user_id, name: m.full_name })}
                    className="text-xs px-2 py-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {removeConfirm && (
        <ConfirmModal
          message={`Remove ${removeConfirm.name} from ${group.name}?`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeMember(removeConfirm.userId);
            setRemoveConfirm(null);
          }}
          onCancel={() => setRemoveConfirm(null)}
        />
      )}
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
  const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Group[]>("/admin/groups", { params: { page: 1, page_size: 500 } });
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
      setNewName(""); setNewDesc("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (id: number) => {
    await api.delete(`/admin/groups/${id}`);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Groups <span className="text-sm font-normal text-gray-400 dark:text-gray-500">({groups.length})</span>
      </h2>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Group name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Friends, Office" className={inputCls} onKeyDown={(e) => e.key === "Enter" && createGroup()} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description (optional)</label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={inputCls} />
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded hover:bg-gray-700 dark:hover:bg-white disabled:opacity-50 sm:shrink-0"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">No groups yet.</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-start gap-3 sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{g.name}</div>
                  {g.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{g.description}</div>}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {g.member_count} member{g.member_count !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setSelected(g)} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                    Members
                  </button>
                  <button onClick={() => setDeleteConfirm(g)} className="text-xs px-2 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <GroupDetail group={selected} onClose={() => { setSelected(null); load(); }} />
      )}

      {deleteConfirm && (
        <ConfirmModal
          message={`Delete group "${deleteConfirm.name}"? Members will lose group visibility.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteGroup(deleteConfirm.id);
            setDeleteConfirm(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
