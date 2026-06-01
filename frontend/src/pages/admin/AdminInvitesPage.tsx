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
      const { data } = await api.get<Invite[]>("/admin/invites", {
        params: { page: 1, page_size: 200 },
      });
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

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Links</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expires in (hours)</label>
          <input
            type="number"
            min="1"
            value={expiresHours}
            onChange={(e) => setExpiresHours(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm w-24"
          />
        </div>
        <button
          onClick={createInvite}
          disabled={creating}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Generate invite"}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : invites.length === 0 ? (
        <div className="text-sm text-gray-400">No invites yet.</div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const expired = new Date(inv.expires_at) < new Date();
            return (
              <div
                key={inv.id}
                className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${
                  inv.used || expired ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-600 truncate">{inv.registration_url}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Expires {new Date(inv.expires_at).toLocaleString()}
                    {inv.used && <span className="ml-2 text-orange-500">used</span>}
                    {!inv.used && expired && <span className="ml-2 text-red-500">expired</span>}
                  </div>
                </div>
                <button
                  onClick={() => copyLink(inv)}
                  disabled={inv.used || expired}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
                >
                  {copied === inv.id ? "Copied!" : "Copy link"}
                </button>
                {!inv.used && !expired && (
                  <button
                    onClick={() => revokeInvite(inv.token)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 whitespace-nowrap"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
