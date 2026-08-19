import { cn } from "@/lib/utils";

export function DentalMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.55_0.12_205)] text-primary-foreground shadow-[0_10px_28px_-12px_oklch(0.45_0.12_195/0.8)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.7 5.1C12 3.7 14.1 5 16 5c1.9 0 4-1.3 6.3.1 3 1.8 3 6.1 1.8 9.3-.9 2.4-2.2 3.6-2.7 6.1-.7 3.5-1.3 6.5-3.2 6.5-1.7 0-1.3-4.1-2.2-4.1s-.5 4.1-2.2 4.1c-1.9 0-2.5-3-3.2-6.5-.5-2.5-1.8-3.7-2.7-6.1C6.7 11.2 6.7 6.9 9.7 5.1Z"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 8.7c1.3.8 2.6 1.1 4 1.1s2.7-.3 4-1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
      </svg>
      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/70" />
    </div>
  );
}
