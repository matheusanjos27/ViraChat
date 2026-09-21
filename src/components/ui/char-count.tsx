"use client";

/** Contador vivo de caracteres: 200/1000 */
export function CharCount({
  value,
  max,
  className = "",
}: {
  value: string;
  max: number;
  className?: string;
}) {
  const n = value.length;
  const over = n > max;
  const near = !over && n >= Math.floor(max * 0.9);

  return (
    <p
      className={`mt-1.5 text-right text-xs tabular-nums ${
        over
          ? "font-semibold text-danger"
          : near
            ? "font-medium text-warn"
            : "text-ink-muted"
      } ${className}`}
      aria-live="polite"
    >
      {n.toLocaleString("pt-BR")}/{max.toLocaleString("pt-BR")}
    </p>
  );
}
