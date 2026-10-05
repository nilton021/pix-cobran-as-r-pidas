import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Pix Charges" },
      { name: "description", content: "Acesse o Pix Charges para emitir cobranças Pix com QR Code dinâmico." },
      { property: "og:title", content: "Entrar — Pix Charges" },
      { property: "og:description", content: "Emita e acompanhe cobranças Pix via PicPay Business." },
    ],
  }),
  component: Login,
});

const schema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(6, "Mínimo de 6 caracteres") });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/" });
        else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      toast.error((err as Error).message === "Invalid login credentials" ? "E-mail ou senha incorretos" : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-primary-foreground"><QrCode className="h-7 w-7" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Pix Charges</h1>
          <p className="text-sm text-muted-foreground">Cobranças Pix com QR Code dinâmico</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "up")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Entrar</TabsTrigger>
              <TabsTrigger value="up">Criar conta</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div className="space-y-1.5"><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}</Button>
        </form>
      </div>
    </div>
  );
}
