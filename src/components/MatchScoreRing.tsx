interface Props {
  label: string;
  score: number;
  tone?: "muted" | "accent";
}

export const MatchScoreRing = ({ label, score, tone = "accent" }: Props) => {
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  const ringColor = tone === "accent" ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke={ringColor}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{safe}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
};
