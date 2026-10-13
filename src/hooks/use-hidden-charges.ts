import { useEffect, useState } from "react";

const STORAGE_KEY = "pix-cobrancas-ocultas-v1";
const CHANGE_EVENT = "pix-cobrancas-ocultas-change";

function readHiddenIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Oculta cobranças somente na interface deste navegador; não altera o banco nem o provedor. */
export function useHiddenCharges() {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setHiddenIds(readHiddenIds());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);

  const update = (next: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHiddenIds(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // If browser storage is unavailable, do not pretend the preference persisted.
      setHiddenIds(next);
    }
  };

  return {
    hiddenIds,
    hideCharge: (id: string) => update([...new Set([...readHiddenIds(), id])]),
    restoreCharge: (id: string) => update(readHiddenIds().filter((hiddenId) => hiddenId !== id)),
  };
}
