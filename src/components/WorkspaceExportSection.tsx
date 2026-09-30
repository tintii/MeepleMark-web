import { useState } from "react";
import { serializeWorkspace, workspaceExportFilename } from "../export/workspaceExport";
import { readWorkspaceSnapshot } from "../storage/scopedDb";
import { GroupedSection } from "./PageHeader";

export function WorkspaceExportSection() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function exportWorkspace(): Promise<void> {
    setExporting(true);
    setMessage(null);
    try {
      const date = new Date();
      const text = serializeWorkspace(await readWorkspaceSnapshot(), date);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = workspaceExportFilename(date);
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setMessage({ kind: "success", text: "Workspace export downloaded." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Nothing was exported because the workspace could not be read." });
    } finally {
      setExporting(false);
    }
  }

  return <GroupedSection title="Export workspace">
    <p>Download this active workspace as JSON. The file contains private collection, player, and play data, so store it carefully.</p>
    <p className="type-caption">This personal export works offline and is not an operator backup of the server database.</p>
    <button type="button" onClick={() => void exportWorkspace()} disabled={exporting}>{exporting ? "Exporting…" : "Export workspace"}</button>
    {message && <p className={message.kind === "error" ? "form-error" : "type-caption"} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
  </GroupedSection>;
}
