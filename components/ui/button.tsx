import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-forest-100",
  {
    variants: {
      variant: {
        default: "bg-forest-600 text-white hover:bg-forest-700",
        secondary: "bg-forest-100 text-forest-800 hover:bg-forest-200",
        outline: "border border-forest-100 bg-white text-forest-800 hover:bg-forest-50",
        warning: "bg-honey-500 text-white hover:bg-honey-600",
        ghost: "text-forest-800 hover:bg-forest-50"
      },
      size: {
        default: "min-h-12",
        lg: "min-h-14 text-base",
        icon: "h-12 w-12 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";
