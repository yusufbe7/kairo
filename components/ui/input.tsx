import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-[10px] border border-input bg-white/[0.03] px-3 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-dim focus:border-brand/45 focus:shadow-[0_0_0_3px_rgba(147,171,255,0.1)] disabled:opacity-50 [color-scheme:dark]";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-9", className)} {...props} />
));
Input.displayName = "Input";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, "h-9 cursor-pointer appearance-none pr-7", className)} {...props} />
));
Select.displayName = "Select";

export { Input, Select, fieldBase };
