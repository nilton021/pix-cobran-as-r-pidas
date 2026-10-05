import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCNPJ, isValidCPF, maskDocument, onlyDigits } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().refine((d) => (d.length === 11 ? isValidCPF(d) : d.length === 14 ? isValidCNPJ(d) : false), "CPF/CNPJ inválido"),
});

export function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: Tables<"accounts"> | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [doc, setDoc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(account?.name ?? ""); setEmail(account?.email ?? ""); setDoc(account ? maskDocument(account.document) : ""); }
  }, [open, account]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, document: onlyDigits(doc) });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload = { ...parsed.data, document_type: parsed.data.document.length === 11 ? "CPF" : "CNPJ" };
    const { data: u } = await supabase.auth.getUser();
    const { error } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, owner_id: u.user!.id });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar conta");
    toast.success(account ? "Conta atualizada" : "Conta criada");
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["account"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>CPF ou CNPJ</Label><Input inputMode="numeric" value={doc} onChange={(e) => setDoc(maskDocument(e.target.value))} placeholder="000.000.000-00" /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
