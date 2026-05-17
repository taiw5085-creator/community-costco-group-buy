import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-14 w-full rounded-2xl border border-forest-100 bg-white px-4 text-base font-bold text-forest-900 outline-none transition placeholder:text-zinc-400 focus:border-forest-500 focus:ring-4 focus:ring-forest-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
