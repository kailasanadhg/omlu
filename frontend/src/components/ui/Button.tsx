import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs font-semibold h-8",
    md: "px-4 py-2.5 text-sm font-semibold h-11",
    lg: "px-6 py-3.5 text-base font-semibold h-13",
  }[size];

  const variantClasses = {
    primary: "bg-black text-white hover:bg-neutral-900 focus-visible:outline-black",
    secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:outline-neutral-300",
    outline: "border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-50 focus-visible:outline-neutral-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
    ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
