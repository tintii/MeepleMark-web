import { useEffect, useRef, useState } from "react";
import { shouldShowIosInstallHint } from "./iosInstall";

export function IosInstallHint() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = typeof window !== "undefined" && shouldShowIosInstallHint(
    window.navigator,
    window.matchMedia?.("(display-mode: standalone)").matches ?? false,
  );

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!visible) return null;

  return (
    <div className={`ios-install${open ? " is-open" : ""}`} ref={containerRef}>
      <button
        className="ios-install-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="ios-install-instructions"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ios-install-icon" aria-hidden="true">&#8593;</span>
        <span className="ios-install-label">Install</span>
      </button>
      <div className="ios-install-card" id="ios-install-instructions">
        <strong>Add MeepleMark to your Home Screen</strong>
        <p>Tap Safari&rsquo;s Share button, then choose <strong>Add to Home Screen</strong>.</p>
      </div>
    </div>
  );
}
