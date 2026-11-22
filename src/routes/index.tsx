import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Copy, MessageCircle, QrCode, ShieldCheck, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import merchant from "@/assets/pix-merchant.webp.asset.json";

const publicURL = "https://pix-cobrancas-rapidas.lovable.app/";
const invitation = "Conheça o Pix Charges: cobranças Pix com QR Code e acompanhamento de pagamentos para seu negócio. ";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pix Charges — Cobranças Pix para seu negócio" },
      { name: "description", content: "Conheça o Pix Charges: organize cobranças Pix com QR Code, compartilhe com clientes e acompanhe pagamentos. Cadastre seu negócio." },
      { property: "og:title", content: "Pix Charges — Cobranças Pix para seu negócio" },
      { property: "og:description", content: "Uma forma de organizar as cobranças Pix do seu comércio. Conheça e crie seu acesso." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: publicURL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: publicURL }],
  }),
  component: MerchantPage,
});

function MerchantPage() {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicURL);
      toast.success("Link do Pix Charges copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie o endereço exibido abaixo.");
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold text-lg"><QrCode className="size-7 text-primary" />Pix Charges</Link>
          <nav className="flex items-center gap-2" aria-label="Navegação pública">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/como-funciona">Como funciona</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/login">Entrar</Link></Button>
          </nav>
        </div>
      </header>
      <main>
        <section className="merchant-cover relative isolate overflow-hidden">
          <img src={merchant.url} alt="Comerciante atendendo uma cliente em sua floricultura" width="1200" height="675" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
          <div className="merchant-shade absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
            <p className="flex items-center gap-2 text-sm font-semibold"><Store className="size-4" /> Para quem faz o comércio acontecer</p>
            <h1 className="mt-5 text-5xl font-extrabold sm:text-6xl">Pix Charges</h1>
            <p className="mt-5 max-w-md text-2xl font-semibold leading-snug">Seu negócio vende.<br />Seu Pix fica organizado.</p>
            <p className="mt-5 max-w-md text-base leading-7">Crie cobranças com QR Code, envie aos clientes e acompanhe a confirmação dos pagamentos em um só lugar.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary"><Link to="/login" search={{ cadastro: true }}>Cadastrar meu negócio<ArrowRight className="size-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-current bg-transparent text-inherit hover:bg-secondary hover:text-secondary-foreground"><Link to="/como-funciona">Como funciona<BookOpen className="size-4" /></Link></Button>
            </div>
          </div>
        </section>
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
            {[
              { icon: QrCode, title: "Uma cobrança, um QR Code", text: "Valor, descrição e prazo definidos para cada pedido ou serviço." },
              { icon: MessageCircle, title: "Perto do seu cliente", text: "Compartilhe o link de pagamento ou Pix Copia e Cola no seu atendimento." },
              { icon: Wallet, title: "Recebimentos organizados", text: "Acompanhe o status das cobranças na sua área privada." },
            ].map(({ icon: Icon, title, text }) => <article key={title}><Icon className="size-6 text-primary" /><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>)}
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div><p className="text-sm font-semibold text-primary">Do balcão à prestação de serviços</p><h2 className="mt-3 text-3xl font-extrabold">Um próximo passo para o seu comércio.</h2><p className="mt-4 leading-7 text-muted-foreground">Para lojas, profissionais e pequenos negócios que querem organizar as cobranças feitas por Pix. Crie seu acesso e configure a integração de pagamento na sua área privada.</p><p className="mt-4 text-sm leading-6 text-muted-foreground">O uso depende das credenciais de API e da disponibilidade da integração com seu provedor. O Pix Charges acompanha cobranças; o dinheiro é recebido pela instituição de pagamento configurada.</p></div>
          <ol className="divide-y border-y">
            {[["01", "Crie seu acesso", "Cadastre seu nome, e-mail e senha. Confirme seu e-mail quando solicitado."], ["02", "Prepare seu negócio", "Cadastre sua conta e as credenciais do provedor de pagamento."], ["03", "Envie sua primeira cobrança", "Defina os dados do pedido, gere o Pix e compartilhe com seu cliente."]].map(([number, title, text]) => <li key={number} className="flex gap-5 py-5"><span className="font-mono text-lg text-primary">{number}</span><div><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div></li>)}
          </ol>
        </section>
        <section className="border-y bg-secondary/50">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-9 sm:flex-row sm:items-center"><ShieldCheck className="size-9 shrink-0 text-primary" /><div><h2 className="text-lg font-bold">Seu financeiro continua privado.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Esta página é só um convite. Contas, cobranças e credenciais ficam na área protegida do responsável pelo negócio.</p></div></div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center"><div><h2 className="text-3xl font-extrabold">Conhece outro comerciante?</h2><p className="mt-3 text-muted-foreground">Convide quem também quer organizar suas cobranças Pix.</p></div><div className="flex flex-wrap gap-3"><Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(invitation + publicURL)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />WhatsApp</a></Button><Button variant="outline" onClick={copyLink}><Copy className="size-4" />Copiar link</Button></div></div>
          <p className="mt-5 break-all text-sm text-muted-foreground">{publicURL}</p>
          <div className="mt-12 flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 font-semibold"><Check className="size-5 text-primary" />Pronto para organizar seu Pix?</p><Button asChild size="lg"><Link to="/login" search={{ cadastro: true }}>Criar meu acesso<ArrowRight className="size-4" /></Link></Button></div>
        </section>
      </main>
      <footer className="border-t"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-6 text-sm text-muted-foreground"><span>Pix Charges · Cobranças para o seu negócio</span><Link to="/como-funciona" className="hover:text-primary">Como funciona</Link></div></footer>
    </div>
  );
}