import type { ReactNode } from "react";

/**
 * A minimal modal dialog — used for the two-step completion confirmation
 * (add-to-collection offer, then "Play recorded") and the destructive
 * remove-from-collection confirmation. No dialog library: this project
 * stays dependency-light, and a plain overlay + panel is enough.
 */
export function Dialog({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children: ReactNode;
}) {
  return (
    <div className="dialog-overlay" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true">
        <h2 className="type-title">{title}</h2>
        {message && <p className="type-caption">{message}</p>}
        <div className="dialog-actions">{children}</div>
      </div>
    </div>
  );
}
