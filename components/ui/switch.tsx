"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn("peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-white/[0.12] p-0.5 transition-colors data-[state=checked]:bg-brand disabled:opacity-50", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 data-[state=checked]:translate-x-3.5" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";

export { Switch };
