import type { CSSProperties } from "react";
import { BANK_BRANDS, type BankBrandId } from "@/lib/bank-brands";
import { cn } from "@/lib/utils";

/**
 * Camada decorativa: "bandeiras" de bancos flutuando ao fundo.
 * Fica atrás do conteúdo, não recebe cliques e é ignorada por leitores de tela.
 * Os quadrados de marca dão o campo de fundo; as etiquetas com nome ficam
 * ancoradas nas faixas de respiro do topo e da base, sempre longe do texto.
 */

type Depth = "far" | "mid" | "near";

const DEPTH: Record<Depth, { scale: number; opacity: number; blur: number }> = {
  far: { scale: 0.68, opacity: 0.36, blur: 1.8 },
  mid: { scale: 0.85, opacity: 0.52, blur: 0.8 },
  near: { scale: 1.02, opacity: 0.68, blur: 0 },
};

type Band = "top" | "bottom";
type Flag = {
  id: BankBrandId;
  left: string;
  /** distância da borda, no celular */
  sm: number;
  /** distância da borda, no computador (onde há mais respiro) */
  md: number;
  depth: Depth;
  band: Band;
  /** exibe apenas em telas médias ou maiores, onde há largura livre */
  wideOnly?: boolean;
};

// Posições fixas (sem aleatoriedade) para renderizar igual no servidor e no navegador.
const FLAGS: Flag[] = [
  { id: "PICPAY", left: "6%", sm: 16, md: 48, depth: "near", band: "top" },
  { id: "ITAU", left: "24%", sm: 40, md: 40, depth: "mid", band: "top", wideOnly: true },
  { id: "NUBANK", left: "52%", sm: 20, md: 52, depth: "mid", band: "top", wideOnly: true },
  { id: "SANTANDER", left: "47%", sm: 44, md: 56, depth: "far", band: "top", wideOnly: true },
  { id: "BRADESCO", left: "80%", sm: 40, md: 44, depth: "far", band: "top", wideOnly: true },
  { id: "MERCADOPAGO", left: "5%", sm: 16, md: 44, depth: "mid", band: "bottom", wideOnly: true },
  { id: "INTER", left: "30%", sm: 16, md: 56, depth: "near", band: "bottom" },
  { id: "EFI", left: "50%", sm: 16, md: 40, depth: "far", band: "bottom", wideOnly: true },
  { id: "ASAAS", left: "72%", sm: 16, md: 48, depth: "mid", band: "bottom", wideOnly: true },
];

/** Quadrados de marca espalhados: dão profundidade e funcionam em qualquer largura. */
const TILES: { id: BankBrandId; style: CSSProperties; size: number; opacity: number; blur: number }[] = [
  { id: "PICPAY", style: { left: "2%", top: "22%" }, size: 34, opacity: 0.22, blur: 1.5 },
  { id: "NUBANK", style: { left: "12%", top: "70%" }, size: 26, opacity: 0.18, blur: 2 },
  { id: "INTER", style: { left: "33%", top: "12%" }, size: 30, opacity: 0.2, blur: 1.6 },
  { id: "SANTANDER", style: { left: "44%", top: "78%" }, size: 24, opacity: 0.18, blur: 2.2 },
  { id: "MERCADOPAGO", style: { left: "58%", top: "16%" }, size: 20, opacity: 0.2, blur: 1.8 },
  { id: "EFI", style: { left: "66%", top: "72%" }, size: 22, opacity: 0.18, blur: 1.8 },
  { id: "ASAAS", style: { left: "78%", top: "26%" }, size: 28, opacity: 0.2, blur: 1.4 },
  { id: "BRADESCO", style: { left: "90%", top: "64%" }, size: 26, opacity: 0.18, blur: 2 },
  { id: "ITAU", style: { left: "6%", top: "46%" }, size: 18, opacity: 0.16, blur: 2.4 },
  { id: "PICPAY", style: { right: "3%", top: "38%" }, size: 40, opacity: 0.16, blur: 2.6 },
  { id: "INTER", style: { right: "8%", top: "84%" }, size: 18, opacity: 0.14, blur: 2 },
  { id: "NUBANK", style: { right: "1%", top: "8%" }, size: 22, opacity: 0.16, blur: 2.2 },
  { id: "EFI", style: { left: "26%", top: "90%" }, size: 16, opacity: 0.14, blur: 2.4 },
  { id: "SANTANDER", style: { left: "88%", top: "10%" }, size: 18, opacity: 0.14, blur: 2.2 },
  { id: "ASAAS", style: { left: "40%", top: "5%" }, size: 20, opacity: 0.14, blur: 2.4 },
  { id: "MERCADOPAGO", style: { left: "18%", top: "36%" }, size: 16, opacity: 0.12, blur: 2.6 },
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
        className="absolute -left-28 top-10 h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 11%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-24 bottom-4 h-80 w-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--success) 10%, transparent), transparent 70%)",
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
                "--flag-duration": `${17 + (i % 5) * 4}s`,
                "--flag-delay": `${-(i * 2.6)}s`,
                "--flag-rot": `${-7 + (i % 4) * 4}deg`,
                "--flag-dx": `${(i % 2 === 0 ? 1 : -1) * (7 + (i % 3) * 4)}px`,
                "--flag-dy": `${-(7 + (i % 4) * 6)}px`,
                "--flag-spin": `${i % 2 === 0 ? 7 : -6}deg`,
              } as CSSProperties
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
        // a faixa do topo desce pouco e a da base sobe pouco: nada invade o conteúdo
        const dy = flag.band === "top" ? 7 + (i % 3) * 3 : -(5 + (i % 3) * 3);
        const spin = i % 2 === 0 ? 4 : -3;

        return (
          <div
            key={`${flag.id}-${i}`}
            className={cn(
              "bank-flag absolute",
              flag.band === "top" ? "bf-top" : "bf-bottom",
              flag.wideOnly && "hidden md:block",
            )}
            style={
              {
                left: flag.left,
                "--bf-sm": `${flag.sm}px`,
                "--bf-md": `${flag.md}px`,
                "--flag-duration": `${duration}s`,
                "--flag-delay": `${delay}s`,
                "--flag-rot": `${rotate}deg`,
                "--flag-dx": `${dx}px`,
                "--flag-dy": `${dy}px`,
                "--flag-spin": `${spin}deg`,
              } as CSSProperties
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
