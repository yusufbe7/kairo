import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const PALETTES: [string, string][] = [
  ["#1B2231", "#44557D"], ["#2A1F1B", "#7A5543"], ["#15241E", "#35664F"], ["#221B2B", "#584476"],
  ["#1A1B1E", "#4A4D55"], ["#2A2418", "#7B6835"], ["#1A2328", "#3C6A78"], ["#2A1A20", "#7A4152"],
];

/**
 * Media thumbnail. Renders the real image when `src` is set, otherwise an
 * abstract placeholder (4 compositions × 8 muted palettes) so mock data looks like real media.
 */
export function Thumb({ i = 0, src, video, className, rounded = "rounded-[10px]" }: { i?: number; src?: string; video?: boolean; className?: string; rounded?: string }) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const v = i % 4;
  return (
    <div className={cn("relative shrink-0 overflow-hidden", rounded, className)} style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          {v === 0 && (<><div className="absolute -bottom-[30%] -right-[18%] aspect-square w-[70%] rounded-full bg-white/[0.07]" /><div className="absolute left-[14%] top-[18%] aspect-square w-[38%] rounded-full border border-white/[0.12]" /></>)}
          {v === 1 && (<><div className="absolute left-[27%] top-[30%] aspect-square w-[46%] rounded-full" style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,236,210,.35), rgba(255,236,210,.05) 70%)" }} /><div className="absolute inset-x-0 bottom-0 h-[38%] border-t border-white/[0.08] bg-black/30" /></>)}
          {v === 2 && (<><div className="absolute -bottom-[10%] left-[14%] right-[14%] top-[22%] rounded-lg border border-white/10 bg-[rgba(10,12,16,.45)]" /><div className="absolute left-[22%] top-[32%] h-[5px] w-[30%] rounded bg-white/[0.28]" /><div className="absolute left-[22%] top-[calc(32%+11px)] h-[5px] w-[52%] rounded bg-white/[0.12]" /></>)}
          {v === 3 && (<><div className="absolute -inset-[40%]" style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,.05) 0 14px, transparent 14px 40px)" }} /><div className="absolute right-[12%] top-[16%] aspect-square w-[34%] rotate-12 rounded-xl bg-white/10" /></>)}
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,.12), transparent 50%)" }} />
        </>
      )}
      {video && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 backdrop-blur-md"><Play size={12} fill="#fff" className="text-white" /></div>
        </div>
      )}
    </div>
  );
}
