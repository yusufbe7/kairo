import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border text-[13px] font-medium transition-[background,border-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground hover:border-border-strong hover:bg-white/[0.07]",
        primary: "border-transparent bg-primary text-primary-foreground hover:bg-white",
        brand: "border-transparent bg-brand text-brand-foreground shadow-[0_8px_24px_-10px_rgba(147,171,255,0.7)] hover:bg-[#A9BCFF]",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-white/5",
        danger: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-[30px] gap-1.5 rounded-lg px-2.5 text-xs",
        lg: "h-11 rounded-xl px-5 text-sm",
        icon: "h-9 w-9",
        "icon-sm": "h-[30px] w-[30px] rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
