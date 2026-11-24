import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
  label: string;
  triggerClassName: string;
  trigger: ReactNode;
  /** Opens upwards when the trigger sits near the bottom of the screen. */
  placement?: "above" | "below";
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}

const MENU_GAP = 4;

export default function DropdownMenu({
  label,
  triggerClassName,
  trigger,
  placement = "below",
  disabled = false,
  children,
}: DropdownMenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const isOpen = anchor !== null;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target)) {
        return;
      }
      setAnchor(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnchor(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  // Cards clip their overflow, so the menu is drawn on the page instead.
  const toggle = () => {
    setAnchor(
      isOpen ? null : (button.current?.getBoundingClientRect() ?? null),
    );
  };

  const verticalPosition = (rect: DOMRect) =>
    placement === "above"
      ? { bottom: window.innerHeight - rect.top + MENU_GAP }
      : { top: rect.bottom + MENU_GAP };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        onClick={toggle}
        disabled={disabled}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {anchor &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{
              ...verticalPosition(anchor),
              right: window.innerWidth - anchor.right,
            }}
            className="fixed z-110 flex w-56 flex-col gap-1 rounded-md border border-surface bg-surface p-2 shadow-lg"
          >
            {children(() => setAnchor(null))}
          </div>,
          document.body,
        )}
    </div>
  );
}
