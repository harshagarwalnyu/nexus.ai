import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  action: () => void;
  label: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      for (const s of shortcuts) {
        const keyMatch = event.key.toLowerCase() === s.key.toLowerCase();

        const modifierKey = isMac ? event.metaKey : event.ctrlKey;
        const modifierMatch = (s.meta || s.ctrl) ? modifierKey : (!event.metaKey && !event.ctrlKey);

        const altMatch = !!s.alt === event.altKey;

        if (keyMatch && modifierMatch && altMatch) {
          event.preventDefault();
          s.action();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}