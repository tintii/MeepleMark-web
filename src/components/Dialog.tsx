import { useEffect, useId, useRef, type ReactNode } from "react";

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
  onCancel,
  pending = false,
}: {
  title: string;
  message?: string;
  children: ReactNode;
  onCancel?: () => void;
  pending?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    dialog.showModal();
    const initial = dialog.querySelector<HTMLElement>("[autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]");
    initial?.focus();
    return () => {
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
        else document.querySelector<HTMLElement>("[data-dialog-fallback]")?.focus();
      });
    };
  }, []);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!pending) onCancel?.();
  }

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={titleId} onCancel={handleCancel}>
      <h2 id={titleId} className="type-title">{title}</h2>
      {message && <p className="type-caption">{message}</p>}
      <div className="dialog-actions" aria-busy={pending}>{children}</div>
    </dialog>
  );
}
