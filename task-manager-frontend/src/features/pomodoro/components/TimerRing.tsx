const RADIUS = 76;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_STROKE = {
  focus: "stroke-brand",
  rest: "stroke-success",
  due: "stroke-warning",
} as const;

export type RingTone = keyof typeof TONE_STROKE;

interface TimerRingProps {
  fractionLeft: number;
  tone: RingTone;
  children: React.ReactNode;
}

export function TimerRing({ fractionLeft, tone, children }: TimerRingProps) {
  const filled = Math.min(1, Math.max(0, fractionLeft));

  return (
    <div className="relative w-44 h-44">
      <svg
        viewBox="0 0 170 170"
        className="-rotate-90 w-full h-full"
        aria-hidden
      >
        <circle
          cx="85"
          cy="85"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx="85"
          cy="85"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
          className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-300`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}
