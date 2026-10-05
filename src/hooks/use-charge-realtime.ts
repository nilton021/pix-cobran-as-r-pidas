import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Escuta mudanças em charges (RLS filtra só as do usuário) e invalida as queries
export function useChargesRealtime(filter?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`charges-${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "charges", ...(filter ? { filter } : {}) }, () => {
        qc.invalidateQueries({ queryKey: ["charges"] });
        qc.invalidateQueries({ queryKey: ["charge"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter, qc]);
}
