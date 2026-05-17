import * as React from "react";
import { cn } from "@/lib/utils";

const styles = {
  default: "bg-forest-100 text-forest-800",
  hot: "bg-rose-50 text-rose-600",
  deal: "bg-honey-50 text-honey-600",
  muted: "bg-zinc-100 text-zinc-600",
  success: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  danger: "bg-rose-50 text-rose-700"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof styles }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
