import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl px-3.5 py-2 text-sm font-semibold",
          "bg-black/10 border border-white/[0.10] text-foreground",
          "placeholder:text-muted-foreground/60",
          "transition-all duration-200 ease-out",
          "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.06]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
