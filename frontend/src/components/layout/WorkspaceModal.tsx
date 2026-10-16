import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { FiCopy, FiKey, FiLink, FiLogIn, FiPlusSquare } from "react-icons/fi";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useWorkspace } from "../../context/WorkspaceContext";

const copy = (text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Clipboard unavailable - select and copy manually")
  );

export const WorkspaceModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { workspace, join, startNew } = useWorkspace();
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"join" | "new" | null>(null);
  const shareLink = workspace ? `${window.location.origin}/join/${workspace.key}` : "";

  const doJoin = async () => {
    setBusy("join");
    try {
      const w = await join(key.trim());
      toast.success(`Workspace opened · ${w.cases} case${w.cases === 1 ? "" : "s"}`);
      setKey("");
      onClose();
      navigate("/cases");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doNew = async () => {
    if (!window.confirm("Start an empty workspace? Save your current key first - it's the only way back to these cases.")) return;
    setBusy("new");
    try {
      await startNew();
      toast.success("New workspace started");
      onClose();
      navigate("/cases");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Workspace" className="max-w-lg">
      <div className="space-y-6 p-5">
        <p className="text-sm text-slate-400">
          ThreatLens needs no account. Your cases and watchlist live in a private workspace tied to this browser. Use the key to open it on another device or to
          collaborate with a teammate.
        </p>

        {workspace && (
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
            <div className="flex items-center justify-between">
              <span className="label flex items-center gap-1.5"><FiKey /> Your workspace key</span>
              <span className="text-xs text-slate-500">{workspace.cases} cases · {workspace.watchlist} watchlist entries</span>
            </div>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded-lg bg-ink-950 px-3 py-2 font-mono text-sm text-accent">{workspace.key}</code>
              <Button variant="secondary" size="sm" icon={<FiCopy />} onClick={() => copy(workspace.key, "Key")} aria-label="Copy key" />
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" icon={<FiLink />} onClick={() => copy(shareLink, "Share link")}>
              Copy share link for a teammate
            </Button>
            <p className="mt-2 text-xs text-slate-500">Anyone with this key can view and edit this workspace. Keep it private.</p>
          </div>
        )}

        <div>
          <label htmlFor="ws-key" className="label mb-2 block">Open another workspace</label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (key.trim()) doJoin();
            }}
          >
            <input id="ws-key" className="input font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={key} onChange={(e) => setKey(e.target.value)} />
            <Button type="submit" icon={<FiLogIn />} loading={busy === "join"} disabled={!key.trim()}>Open</Button>
          </form>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <Button variant="ghost" size="sm" icon={<FiPlusSquare />} loading={busy === "new"} onClick={doNew}>Start a fresh workspace</Button>
        </div>
      </div>
    </Modal>
  );
};
