import { BANK_BRANDS, type BankBrandId } from "@/lib/bank-brands";
import { cn } from "@/lib/utils";

/**
 * Camada decorativa: "bandeiras" de bancos flutuando ao fundo.
 * Fica atrás do conteúdo, não recebe cliques e é ignorada por leitores de tela.
 * As bandeiras com nome ficam só nas faixas livres (topo e base da tela), para
 * não competir com o título, os botões ou o cartão de fluxo.
 */

type Depth = "far" | "mid" | "near";

const DEPTH: Record<Depth, { scale: number; opacity: number; blur: number }> = {
  far: { scale: 0.68, opacity: 0.34, blur: 1.8 },
  mid: { scale: 0.85, opacity: 0.5, blur: 0.8 },
  near: { scale: 1.02, opacity: 0.66, blur: 0 },
};

type Band = "top" | "bottom";
type Flag = { id: BankBrandId; left: string; top: string; depth: Depth; band: Band };

// Posições fixas (sem aleatoriedade) para renderizar igual no servidor e no navegador.
const FLAGS: Flag[] = [
  { id: "PICPAY", left: "4%", top: "3%", depth: "near", band: "top" },
  { id: "ITAU", left: "26%", top: "7%", depth: "mid", band: "top" },
  { id: "NUBANK", left: "50%", top: "2%", depth: "mid", band: "top" },
  { id: "SANTANDER", left: "71%", top: "6%", depth: "far", band: "top" },
  { id: "BRADESCO", left: "89%", top: "2%", depth: "far", band: "top" },
  { id: "MERCADOPAGO", left: "5%", top: "88%", depth: "mid", band: "bottom" },
  { id: "INTER", left: "27%", top: "85%", depth: "near", band: "bottom" },
  { id: "EFI", left: "51%", top: "90%", depth: "far", band: "bottom" },
  { id: "ASAAS", left: "73%", top: "86%", depth: "mid", band: "bottom" },
];

/** Qua­dradinhos de marca nas margens: dão profundidade sem formar chips cortados. */
const TILES: { id: BankBrandId; style: React.CSSProperties; size: number; opacity: number; blur: number }[] = [
  { id: "PICPAY", style: { left: "-14px", top: "26%" }, size: 34, opacity: 0.22, blur: 1.5 },
  { id: "NUBANK", style: { left: "-8px", top: "58%" }, size: 26, opacity: 0.18, blur: 2 },
  { id: "INTER", style: { right: "-12px", top: "20%" }, size: 30, opacity: 0.2, blur: 1.6 },
  { id: "SANTANDER", style: { right: "-6px", top: "52%" }, size: 24, opacity: 0.16, blur: 2.2 },
  { id: "MERCADOPAGO", style: { left: "1%", top: "76%" }, size: 20, opacity: 0.18, blur: 1.8 },
  { id: "EFI", style: { right: "1%", top: "72%" }, size: 22, opacity: 0.18, blur: 1.8 },
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
        className="absolute -left-24 top-6 h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 15%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-20 bottom-0 h-80 w-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--success) 13%, transparent), transparent 70%)",
        }}
      />

      {TILES.map((tile, i) => {
        const brand = BANK_BRANDS[tile.id];
        return (
          <span
            key={`tile-${tile.id}-${i}`}
            className="bank-flag absolute rounded-xl"
            style={
              {
                ...tile.style,
                width: tile.size,
                height: tile.size,
                opacity: tile.opacity,
                filter: `blur(${tile.blur}px)`,
                backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})`,
                "--flag-duration": `${18 + (i % 4) * 5}s`,
                "--flag-delay": `${-(i * 3.1)}s`,
                "--flag-rot": `${-6 + (i % 3) * 5}deg`,
                "--flag-dx": `${(i % 2 === 0 ? 1 : -1) * 8}px`,
                "--flag-dy": `${-(8 + (i % 3) * 6)}px`,
                "--flag-spin": `${i % 2 === 0 ? 6 : -5}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}

      {FLAGS.map((flag, i) => {
        const brand = BANK_BRANDS[flag.id];
        const depth = DEPTH[flag.depth];
        // variação determinística de movimento: nada depende de Math.random()
        const duration = 11 + (i % 5) * 3;
        const delay = -(i * 1.9);
        const rotate = -8 + (i % 4) * 5;
        const dx = (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 6);
        // a faixa do topo desce e a da base sobe: nenhuma bandeira invade o conteúdo
        const dy = flag.band === "top" ? 14 + (i % 3) * 8 : -(14 + (i % 3) * 10);
        const spin = i % 2 === 0 ? 4 : -3;

        return (
          <div
            key={`${flag.id}-${i}`}
            className="bank-flag absolute"
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
                style={{
                  backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})`,
                }}
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
