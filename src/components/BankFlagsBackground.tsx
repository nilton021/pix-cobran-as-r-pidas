import { useEffect, useState, type CSSProperties } from "react";
import { BANK_BRANDS, type BankBrandId } from "@/lib/bank-brands";
import { cn } from "@/lib/utils";

type Depth = "far" | "mid" | "near";
type Band = "top" | "bottom";

const DEPTH: Record<Depth, { scale: number; opacity: number; blur: number }> = {
  far: { scale: 0.72, opacity: 0.5, blur: 0.6 },
  mid: { scale: 0.86, opacity: 0.62, blur: 0.4 },
  near: { scale: 1.02, opacity: 0.74, blur: 0 },
};

type Flag = {
  id: BankBrandId;
  left: string;
  sm: number;
  md: number;
  depth: Depth;
  band: Band;
  wideOnly?: boolean;
};

const FLAGS: Flag[] = [
  { id: "PICPAY", left: "5%", sm: 12, md: 26, depth: "mid", band: "top" },
  { id: "ITAU", left: "22%", sm: 40, md: 34, depth: "near", band: "top", wideOnly: true },
  { id: "SANTANDER", left: "42%", sm: 44, md: 24, depth: "mid", band: "top", wideOnly: true },
  { id: "NUBANK", left: "56%", sm: 52, md: 32, depth: "far", band: "top" },
  { id: "BRADESCO", left: "84%", sm: 40, md: 26, depth: "mid", band: "top", wideOnly: true },
  { id: "MERCADOPAGO", left: "5%", sm: 16, md: 40, depth: "mid", band: "bottom", wideOnly: true },
  { id: "INTER", left: "6%", sm: 10, md: 44, depth: "mid", band: "bottom" },
  { id: "ASAAS", left: "58%", sm: 46, md: 42, depth: "far", band: "bottom" },
  { id: "EFI", left: "40%", sm: 16, md: 36, depth: "far", band: "bottom", wideOnly: true },
];

const BAND_TILES: { id: BankBrandId; left: string; sm: number; md: number; band: Band; size: number; opacity: number; blur: number }[] = [
  { id: "PICPAY", left: "38%", sm: 12, md: 44, band: "top", size: 26, opacity: 0.2, blur: 1.6 },
  { id: "NUBANK", left: "86%", sm: 18, md: 40, band: "top", size: 20, opacity: 0.18, blur: 2 },
  { id: "ITAU", left: "64%", sm: 8, md: 46, band: "top", size: 16, opacity: 0.16, blur: 2.4 },
  { id: "INTER", left: "58%", sm: 10, md: 40, band: "bottom", size: 22, opacity: 0.18, blur: 1.8 },
  { id: "SANTANDER", left: "10%", sm: 14, md: 44, band: "bottom", size: 18, opacity: 0.16, blur: 2.2 },
  { id: "EFI", left: "84%", sm: 8, md: 38, band: "bottom", size: 24, opacity: 0.18, blur: 1.8 },
];

const TILES: { id: BankBrandId; style: CSSProperties; size: number; opacity: number; blur: number }[] = [
  { id: "PICPAY", style: { left: "2%", top: "26%" }, size: 34, opacity: 0.22, blur: 1.5 },
  { id: "NUBANK", style: { left: "12%", top: "84%" }, size: 26, opacity: 0.18, blur: 2 },
  { id: "INTER", style: { left: "33%", top: "8%" }, size: 30, opacity: 0.2, blur: 1.6 },
  { id: "SANTANDER", style: { left: "44%", top: "88%" }, size: 24, opacity: 0.18, blur: 2.2 },
  { id: "MERCADOPAGO", style: { left: "60%", top: "6%" }, size: 20, opacity: 0.2, blur: 1.8 },
  { id: "EFI", style: { left: "68%", top: "90%" }, size: 22, opacity: 0.18, blur: 1.8 },
  { id: "ASAAS", style: { left: "80%", top: "6%" }, size: 28, opacity: 0.2, blur: 1.4 },
  { id: "BRADESCO", style: { left: "96%", top: "70%" }, size: 26, opacity: 0.18, blur: 2 },
  { id: "ITAU", style: { left: "3%", top: "52%" }, size: 18, opacity: 0.16, blur: 2.4 },
  { id: "PICPAY", style: { right: "2%", top: "40%" }, size: 40, opacity: 0.16, blur: 2.6 },
  { id: "INTER", style: { right: "7%", top: "88%" }, size: 18, opacity: 0.14, blur: 2 },
  { id: "NUBANK", style: { right: "1%", top: "6%" }, size: 22, opacity: 0.16, blur: 2.2 },
  { id: "EFI", style: { left: "26%", top: "94%" }, size: 16, opacity: 0.14, blur: 2.4 },
  { id: "SANTANDER", style: { left: "88%", top: "4%" }, size: 18, opacity: 0.14, blur: 2.2 },
  { id: "ASAAS", style: { left: "40%", top: "3%" }, size: 20, opacity: 0.14, blur: 2.4 },
  { id: "MERCADOPAGO", style: { left: "16%", top: "34%" }, size: 16, opacity: 0.12, blur: 2.6 },
];

function tileVars(i: number, band?: Band): CSSProperties {
  const up = band === "bottom" || !band;
  return {
    "--flag-duration": `${17 + (i % 5) * 4}s`,
    "--flag-delay": `-${i * 2.6}s`,
    "--flag-rot": `${-3 + (i % 3) * 3}deg`,
    "--flag-dx": `${(i % 2 === 0 ? 1 : -1) * (7 + (i % 3) * 4)}px`,
    "--flag-dy": `${(up ? -1 : 1) * (7 + (i % 4) * 6)}px`,
    "--flag-spin": `${i % 2 === 0 ? 4 : -3}deg`,
  } as CSSProperties;
}

type MotionVars = Pick<CSSProperties, "--flag-duration" | "--flag-delay" | "--flag-rot" | "--flag-dx" | "--flag-dy" | "--flag-spin">;

function randomMotion(): MotionVars {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return {
    "--flag-duration": `${12 + Math.random() * 16}s`,
    "--flag-delay": `-${Math.random() * 10}s`,
    "--flag-rot": `${-5 + Math.random() * 10}deg`,
    "--flag-dx": `${direction * (8 + Math.random() * 26)}px`,
    "--flag-dy": `${direction * (6 + Math.random() * 24)}px`,
    "--flag-spin": `${-5 + Math.random() * 10}deg`,
  };
}

function animationStyle(motion: MotionVars): MotionVars {
  return motion;
}

export function BankFlagsBackground({ className }: { className?: string }) {
  const [randomMotions, setRandomMotions] = useState<Record<string, MotionVars>>({});

  useEffect(() => {
    const motions: Record<string, MotionVars> = {};
    BAND_TILES.forEach((tile, i) => { motions[`band-${tile.id}-${i}`] = randomMotion(); });
    TILES.forEach((tile, i) => { motions[`tile-${tile.id}-${i}`] = randomMotion(); });
    FLAGS.forEach((flag, i) => { motions[`${flag.id}-${i}`] = randomMotion(); });
    setRandomMotions(motions);
  }, []);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 select-none overflow-hidden", className)}>
      <div className="absolute -left-28 top-10 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 11%, transparent), transparent 70%)" }} />
      <div className="absolute -right-24 bottom-4 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--success) 10%, transparent), transparent 70%)" }} />

      {BAND_TILES.map((tile, i) => {
        const brand = BANK_BRANDS[tile.id];
        return (
          <span key={`band-${tile.id}-${i}`} className={cn("absolute rounded-xl", tile.band === "top" ? "bf-top" : "bf-bottom")} style={{ left: tile.left, width: tile.size, height: tile.size, opacity: tile.opacity, filter: `blur(${tile.blur}px)`, backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})`, "--bf-sm": `${tile.sm}px`, "--bf-md": `${tile.md}px`, ...animationStyle(randomMotions[`band-${tile.id}-${i}`] ?? tileVars(i, tile.band)) } as CSSProperties}>
          </span>
        );
      })}

      {TILES.map((tile, i) => {
        const brand = BANK_BRANDS[tile.id];
        return (
          <span key={`tile-${tile.id}-${i}`} className="absolute hidden rounded-xl md:block" style={{ ...tile.style, width: tile.size, height: tile.size, opacity: tile.opacity, filter: `blur(${tile.blur}px)`, backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})`, ...animationStyle(randomMotions[`tile-${tile.id}-${i}`] ?? tileVars(i)) } as CSSProperties}>
          </span>
        );
      })}

      {FLAGS.map((flag, i) => {
        const brand = BANK_BRANDS[flag.id];
        const depth = DEPTH[flag.depth];
        const duration = 11 + (i % 5) * 3;
        const delay = -(i * 1.9);
        const rotate = -3 + (i % 3) * 3;
        const dx = (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 6);
        const dy = flag.band === "top" ? 6 + (i % 3) * 3 : -(5 + (i % 3) * 3);
        const spin = i % 2 === 0 ? 2 : -2;

        return (
          <div key={`${flag.id}-${i}`} className={cn("absolute", flag.band === "top" ? "bf-top" : "bf-bottom", flag.wideOnly && "hidden md:block")} style={{ left: flag.left, "--bf-sm": `${flag.sm}px`, "--bf-md": `${flag.md}px`, ...animationStyle(randomMotions[`${flag.id}-${i}`] ?? { "--flag-duration": `${duration}s`, "--flag-delay": `${delay}s`, "--flag-rot": `${rotate}deg`, "--flag-dx": `${dx}px`, "--flag-dy": `${dy}px`, "--flag-spin": `${spin}deg` }) } as CSSProperties}>
            <div className="flex items-center gap-2 rounded-xl border bg-card/85 px-2.5 py-2 shadow-sm" style={{ transform: `scale(${depth.scale})`, opacity: depth.opacity, filter: depth.blur ? `blur(${depth.blur}px)` : undefined }}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-extrabold text-primary-foreground" style={{ backgroundImage: `linear-gradient(135deg, ${brand.color}, ${brand.colorTo})` }}>{brand.initials}</span>
              <span className="whitespace-nowrap text-xs font-semibold text-foreground/80">{brand.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
