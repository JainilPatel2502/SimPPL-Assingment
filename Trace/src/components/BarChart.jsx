import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const VIOLET = "#a78bfa";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 11,
          marginBottom: 2,
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: VIOLET,
          fontSize: 13,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 500,
        }}
      >
        {payload[0].value.toLocaleString()}
      </p>
    </div>
  );
};

export default function BarChart({ data, dataKey, nameKey, onBarClick }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-white/15 text-xs">
        No data
      </div>
    );
  }

  const truncate = (val) =>
    val?.length > 24 ? val.substring(0, 24) + "…" : val;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 8, left: 10, bottom: 10 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={140}
          tick={{
            fill: "rgba(255,255,255,0.3)",
            fontSize: 11,
            fontFamily: "Inter",
          }}
          tickFormatter={truncate}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar
          dataKey={dataKey}
          radius={[0, 3, 3, 0]}
          barSize={9}
          onClick={onBarClick}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
        >
          {(data || []).map((_, i) => (
            <Cell key={i} fill={VIOLET} fillOpacity={0.75 - i * 0.025} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
