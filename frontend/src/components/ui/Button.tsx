import { forwardRef } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-ink-950 hover:bg-accent-soft shadow-[0_0_0_1px_rgba(0,255,157,0.4),0_8px_30px_-6px_rgba(0,255,157,0.55)] hover:shadow-[0_0_0_1px_rgba(0,255,157,0.6),0_10px_40px_-6px_rgba(0,255,157,0.7)] active:scale-[0.98]",
  secondary: "bg-white/[0.06] text-slate-100 border border-white/10 hover:bg-white/[0.1] hover:border-white/20",
  outline: "border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent/70",
  ghost: "text-slate-300 hover:text-white hover:bg-white/[0.06]",
  danger: "bg-sev-critical/10 text-sev-critical border border-sev-critical/30 hover:bg-sev-critical/20",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3.5",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) => (
    <button ref={ref} className={clsx(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  )
);
Button.displayName = "Button";

type LinkButtonProps = CommonProps & { to: string; external?: boolean; download?: boolean | string };

export const LinkButton = ({ variant = "primary", size = "md", icon, className, children, to, external, download }: LinkButtonProps) => {
  const cls = clsx(base, variants[variant], sizes[size], className);
  if (external || download) {
    return (
      <a
        href={to}
        className={cls}
        download={download === true ? "" : download || undefined}
        target={external && !download ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {icon}
      {children}
    </Link>
  );
};
