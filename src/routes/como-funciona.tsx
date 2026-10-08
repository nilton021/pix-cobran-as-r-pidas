import { createFileRoute, Link } from "@tanstack/react-router";
import { BankFlagsBackground } from "@/components/BankFlagsBackground";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  KeyRound,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wallet,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Pix Charges" },
      {
        name: "description",
        content:
          "Entenda como funciona o Pix Charges, como configurar suas credenciais e como usar cobranças Pix com seus clientes.",
      },
    ],
  }),
  component: ComoFunciona,
});

const steps = [
  {
    icon: KeyRound,
    title: "1. Cadastre sua conta",
    text: "Crie seu acesso e, depois do login, cadastre os dados da conta que receberá as cobranças.",
  },
  {
    icon: Wallet,
    title: "2. Configure o banco",
    text: "Informe a instituição de pagamento e as credenciais de API fornecidas pelo seu banco ou provedor.",
  },
  {
    icon: QrCode,
    title: "3. Crie a cobrança",
    text: "Defina o valor, descrição e prazo de expiração. O sistema gera o QR Code e o Pix Copia e Cola.",
  },
  {
    icon: Smartphone,
    title: "4. Envie ao cliente",
    text: "Compartilhe o QR Code ou o código Pix por WhatsApp, e-mail, site ou atendimento presencial.",
  },
  {
    icon: Webhook,
    title: "5. Confirmação automática",
    text: "Quando o pagamento é confirmado, o sistema atualiza a cobrança e registra os dados da confirmação.",
  },
];

function ComoFunciona() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold" aria-label="Pix Charges">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-primary-foreground">
              <QrCode className="h-5 w-5" />
            </span>
            Pix Charges
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Já tenho acesso
            </Link>
            <Button asChild size="sm">
              <Link to="/login">Começar agora <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <BankFlagsBackground />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.15fr_.85fr] md:items-center md:py-24">
            <div>
              <span className="inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                Recebimentos Pix organizados em um só lugar
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-6xl">
                Entenda como o Pix Charges funciona
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Crie cobranças Pix, gere QR Codes, envie para seus clientes e acompanhe
                automaticamente a confirmação dos pagamentos.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/login">Criar minha conta <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <a
                  href="#primeiros-passos"
                  className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
                >
                  Ver como funciona
                </a>
              </div>
            </div>
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-primary-foreground">
                  <QrCode className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold">Fluxo de uma cobrança</p>
                  <p className="text-sm text-muted-foreground">Do pedido ao pagamento confirmado</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {["Criar cobrança", "Gerar QR Code", "Cliente paga", "Confirmar pagamento"].map((item, i) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-bold">{i + 1}</span>
                    <span className="text-sm font-medium">{item}</span>
                    {i < 3 && <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />}
                    {i === 3 && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="primeiros-passos" className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Primeiros passos</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Do cadastro ao primeiro recebimento</h2>
            <p className="mt-3 text-muted-foreground">
              A configuração acontece dentro da sua área autenticada. Esta página explica o processo
              antes de você começar.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((step) => (
              <article key={step.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <step.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
            <article>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">Credenciais</p>
              <h2 className="mt-2 text-2xl font-extrabold">Onde conseguir as credenciais do banco?</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                As credenciais são fornecidas pelo banco ou provedor de pagamentos na área de
                desenvolvedores, integrações ou API. O nome dos campos e o processo de aprovação
                podem variar conforme a instituição.
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  "Acesse a conta empresarial da instituição.",
                  "Procure por API, Integrações, Desenvolvedores ou Aplicações.",
                  "Crie uma aplicação para cobranças Pix, quando necessário.",
                  "Copie somente as credenciais solicitadas pelo Pix Charges.",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h3 className="font-bold">Nunca compartilhe seu segredo</h3>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Client Secret, chaves privadas e outros segredos de API são informações sensíveis.
                Cadastre-os somente no ambiente seguro da plataforma e não os envie por WhatsApp,
                e-mail ou código-fonte.
              </p>
              <div className="mt-5 rounded-xl border bg-muted/40 p-4 text-sm">
                <strong>Importante:</strong> criar um QR Code não significa que o pagamento foi
                recebido. O status deve ser confirmado pelo fluxo de pagamento da instituição.
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Recebimentos externos</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Use as cobranças onde seus clientes estão</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Depois de configurar sua integração, uma cobrança pode ser usada em diferentes
              canais. Você cria o pagamento na plataforma e compartilha o QR Code ou Pix Copia e
              Cola com o cliente.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["WhatsApp", "Envie o QR Code ou Pix Copia e Cola diretamente na conversa."],
              ["Site e loja", "Use sua integração para criar cobranças a partir do seu próprio sistema."],
              ["E-mail", "Inclua os dados da cobrança em uma mensagem ou pedido."],
              ["Atendimento presencial", "Mostre o QR Code na tela ou imprima a cobrança para o cliente."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border bg-card p-5">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <h3 className="font-bold">Para integrações externas</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A plataforma possui uma API de cobranças para que sistemas externos possam criar e
              consultar cobranças de forma programática. A documentação operacional deve ser
              consultada dentro do ambiente da conta antes de colocar uma integração em produção.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ExternalLink className="h-4 w-4" /> API preparada para integração
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="rounded-3xl bg-primary px-6 py-10 text-primary-foreground md:px-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold">Pronto para começar?</h2>
                  <p className="mt-2 max-w-xl text-sm opacity-90">
                    Crie seu acesso e configure sua primeira conta de recebimento.
                  </p>
                </div>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">Criar conta <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <CircleHelp className="h-4 w-4" />
              <span>As instruções específicas de cada banco podem variar conforme a instituição e o ambiente (teste ou produção).</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
