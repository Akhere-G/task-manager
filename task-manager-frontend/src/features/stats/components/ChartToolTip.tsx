interface ChatTooltipProps {
  title?: { name: string; fill?: string; value?: string };
  series?: { name: string; fill?: string; value?: string }[];
}

export default function ChartToolTip({ title, series }: ChatTooltipProps) {
  return (
    <div className="card shadow-2xl">
      {title && (
        <p className="flex items-center gap-2 font-bold text-md mb-2">
          {title.fill && (
            <span
              className={`w-2 h-2 rounded-full ${title.fill}`}
              style={{ background: title.fill }}
            />
          )}
          {title.name}
          {title.value && <span className="font-bold">{title.value}</span>}
        </p>
      )}
      {series &&
        series.map((s) => (
          <p className="flex items-center gap-2 text-md" key={s.name}>
            {s.fill && (
              <span
                className={`w-2 h-2 rounded-full ${s.fill}`}
                style={{ background: s.fill }}
              />
            )}
            <span className="text-sm text-text-main">
              {s.name} {s.value && <span className="font-bold">{s.value}</span>}
            </span>
          </p>
        ))}
    </div>
  );
}
