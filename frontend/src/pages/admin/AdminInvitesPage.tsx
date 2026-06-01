import { useEffect, useState } from "react";
import api from "../../api/axios";
import type { Invite } from "../../types";

export function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [expiresHours, setExpiresHours] = useState("48");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Invite[]>("/admin/invites", { params: { page: 1, page_size: 200 } });
      setInvites(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createInvite = async () => {
    setCreating(true);
    try {
      const body = expiresHours ? { expires_in_hours: Number(expiresHours) } : {};
      await api.post("/admin/invites", body);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const revokeInvite = async (token: string) => {
    await api.delete(`/admin/invites/${token}`);
    await load();
  };

  const copyLink = (inv: Invite) => {
    navigator.clipboard.writeText(inv.registration_url);
    setCopied(inv.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const btnCls = "text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Invite Links</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Expires in (hours)</label>
          <input
            type="number"
            min="1"
            value={expiresHours}
            onChange={(e) => setExpiresHours(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm w-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={createInvite}
          disabled={creating}
          className="px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded hover:bg-gray-700 dark:hover:bg-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Generate invite"}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : invites.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">No invites yet.</div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const expired = new Date(inv.expires_at) < new Date();
            return (
              <div
                key={inv.id}
                className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${inv.used || expired ? "opacity-50" : ""}`}
              >
                <div className="mb-2">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{inv.registration_url}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Expires {new Date(inv.expires_at).toLocaleString()}
                    {inv.used && <span className="ml-2 text-orange-500 dark:text-orange-400">used</span>}
                    {!inv.used && expired && <span className="ml-2 text-red-500 dark:text-red-400">expired</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLink(inv)} disabled={inv.used || expired} className={btnCls}>
                    {copied === inv.id ? "Copied!" : "Copy link"}
                  </button>
                  {!inv.used && !expired && (
                    <button onClick={() => revokeInvite(inv.token)} className="text-xs px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30">
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
