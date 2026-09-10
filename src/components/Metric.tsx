type MetricProps = {
  label: string;
  value: number | string;
  note: string;
  accent?: string;
};

export function Metric({ label, value, note, accent = "blue" }: MetricProps) {
  return (
    <div className={`metric metric-${accent}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}
