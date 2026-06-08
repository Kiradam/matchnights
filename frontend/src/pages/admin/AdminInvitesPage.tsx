import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import { ConfirmModal } from "../../components/ConfirmModal";
import type { Invite } from "../../types";

export function AdminInvitesPage() {
  const { t } = useTranslation();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [expiresHours, setExpiresHours] = useState("48");
  const [revokeConfirm, setRevokeConfirm] = useState<Invite | null>(null);

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
    const text = inv.registration_url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => execCopy(text));
    } else {
      execCopy(text);
    }
    setCopied(inv.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const execCopy = (text: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  };

  const btnCls = "text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t("admin.inviteLinks.title")}</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t("admin.inviteLinks.expiresIn")}</label>
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
          {creating ? t("admin.inviteLinks.creating") : t("admin.inviteLinks.generate")}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">{t("admin.inviteLinks.loading")}</div>
      ) : invites.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">{t("admin.inviteLinks.noInvites")}</div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const expired = new Date(inv.expires_at) < new Date();
            const exhausted = inv.use_count >= inv.max_uses;
            const inactive = expired || exhausted;
            return (
              <div
                key={inv.id}
                className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${inactive ? "opacity-50" : ""}`}
              >
                <div className="mb-2">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{inv.registration_url}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{t("admin.inviteLinks.expires")} {new Date(inv.expires_at).toLocaleString()}</span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className={exhausted ? "text-orange-500 dark:text-orange-400" : ""}>
                      {inv.use_count}/{inv.max_uses} {t("admin.inviteLinks.used")}
                    </span>
                    {exhausted && <span className="text-orange-500 dark:text-orange-400">· {t("admin.inviteLinks.exhausted")}</span>}
                    {!exhausted && expired && <span className="text-red-500 dark:text-red-400">· {t("admin.inviteLinks.expired")}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLink(inv)} disabled={inactive} className={btnCls}>
                    {copied === inv.id ? t("admin.inviteLinks.copied") : t("admin.inviteLinks.copyLink")}
                  </button>
                  {!inactive && (
                    <button
                      onClick={() => setRevokeConfirm(inv)}
                      className="text-xs px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      {t("admin.inviteLinks.revoke")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {revokeConfirm && (
        <ConfirmModal
          message={t("admin.inviteLinks.revokeConfirm")}
          confirmLabel={t("admin.inviteLinks.revoke")}
          onConfirm={() => {
            revokeInvite(revokeConfirm.token);
            setRevokeConfirm(null);
          }}
          onCancel={() => setRevokeConfirm(null)}
        />
      )}
    </div>
  );
}
