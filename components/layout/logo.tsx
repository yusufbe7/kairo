import { KairoMark } from "@/components/brand/mark";

export function Logo({ size = 22, id }: { size?: number; id?: string }) {
  return (
    <span className="flex items-center gap-[9px]">
      <KairoMark size={size + 4} id={id} />
      <span className="text-base font-semibold tracking-[-0.02em]">Kairo</span>
    </span>
  );
}
