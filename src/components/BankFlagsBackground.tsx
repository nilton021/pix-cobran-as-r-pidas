import { BANK_BRANDS, type BankBrandId } from "@/lib/bank-brands";
import { cn } from "@/lib/utils";

/**
 * Camada decorativa: "bandeiras" de bancos flutuando ao fundo.
 * Puramente visual — fica atrás do conteúdo, não recebe cliques e é ignorada por leitores de tela.
 */

type Depth = "far" | "mid" | "near";

const DEPTH: Record<Depth, { scale: number; opacity: number; blur: number }> = {
  // longe: menor, mais transparente e levemente desfocada (sensação de profundidade)
  far: { scale: 0.68, opacity: 0.3, blur: 1.8 },
  mid: { scale: 0.85, opacity: 0.46, blur: 0.8 },
  near: { scale: 1.02, opacity: 0.62, blur: 0 },
};

type Flag = { id: BankBrandId; left: string; top: string; depth: Depth; mdOnly?: boolean };

// Posições fixas (sem aleatoriedade) para renderizar igual no servidor e no navegador.
const FLAGS: Flag[] = [
  { id: "PICPAY", left: "2%", top: "13%", depth: "near" },
  { id: "ITAU", left: "83%", top: "9%", depth: "mid" },
  { id: "NUBANK", left: "9%", top: "42%", depth: "far" },
  { id: "SANTANDER", left: "74%", top: "33%", depth: "near" },
  { id: "BRADESCO", left: "3%", top: "72%", depth: "mid" },
  { id: "MERCADOPAGO", left: "86%", top: "68%", depth: "far" },
  { id: "INTER", left: "20%", top: "86%", depth: "near" },
  { id: "EFI", left: "60%", top: "89%", depth: "mid" },
  { id: "ASAAS", left: "40%", top: "5%", depth: "far", mdOnly: true },
  { id: "PICPAY", left: "55%", top: "79%", depth: "far", mdOnly: true },
  { id: "INTER", left: "33%", top: "24%", depth: "far", mdOnly: true },
  { id: "SANTANDER", left: "26%", top: "62%", depth: "far", mdOnly: true },
  { id: "BRADESCO", left: "68%", top: "17%", depth: "far", mdOnly: true },
  { id: "NUBANK", left: "90%", top: "47%", depth: "far", mdOnly: true },
];

export function BankFlagsBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 select-none overflow-hidden",
        className,
      )}
    >
      {/* brilhos suaves dando profundidade atrás das bandeiras */}
      <div
        className="absolute -left-24 top-8 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)" }}
      />
      <div
        className="absolute -right-16 bottom-4 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--success) 14%, transparent), transparent 70%)" }}
      />

      {FLAGS.map((flag, i) => {
        const brand = BANK_BRANDS[flag.id];
        const depth = DEPTH[flag.depth];
        // variação determinística de movimento: nada depende de Math.random()
        const duration = 15 + (i % 5) * 4;
        const delay = -(i * 2.3);
        const rotate = -9 + (i % 4) * 6;
        const dx = (i % 2 === 0 ? 1 : -1) * (6 + (i % 4) * 5);
        const dy = -(10 + (i % 3) * 9);
        const spin = i % 2 === 0 ? 4 : -3;

        return (
          <div
            key={`${flag.id}-${i}`}
            className={cn("bank-flag absolute", flag.mdOnly && "hidden md:block")}
            style={
              {
                left: flag.left,
                top: flag.top,
                "--flag-duration": `${duration}s`,
                "--flag-delay": `${delay}s`,
                "--flag-rot": `${rotate}deg`,
                "--flag-dx": `${dx}px`,
                "--flag-dy": `${dy}px`,
                "--flag-spin": `${spin}deg`,
              } as React.CSSProperties
            }
          >
            <div
              className="flex items-center gap-2 rounded-xl border bg-card/85 px-2.5 py-2 shadow-sm"
              style={{
                transform: `scale(${depth.scale})`,
                opacity: depth.opacity,
                filter: depth.blur ? `blur(${depth.blur}px)` : undefined,
              }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-extrabold text-primary-foreground"
                style={{ backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})` }}
              >
                {brand.initials}
              </span>
              <span className="whitespace-nowrap text-xs font-semibold text-foreground/80">
                {brand.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
