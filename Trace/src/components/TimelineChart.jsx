import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { format, parseISO } from 'date-fns';

const VIOLET = '#a78bfa';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}>{label}</p>
      <p style={{ color: VIOLET, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
        {payload[0].value.toLocaleString()} posts
      </p>
    </div>
  );
};

export default function TimelineChart({ data, onDateChange }) {
  const formattedData = useMemo(() =>
    (data || []).map(item => ({
      ...item,
      displayDate: format(parseISO(item.date), 'MMM dd'),
      timestamp: parseISO(item.date).getTime(),
    })), [data]);

  if (!formattedData.length) {
    return <div className="flex h-full w-full items-center justify-center text-white/15 text-xs">No temporal data</div>;
  }

  const handleBrushChange = (range) => {
    if (range?.startIndex !== undefined && onDateChange) {
      onDateChange(formattedData[range.startIndex].date, formattedData[range.endIndex].date);
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formattedData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={VIOLET} stopOpacity={0.22} />
            <stop offset="100%" stopColor={VIOLET} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Inter' }}
          axisLine={false} tickLine={false} minTickGap={40} tickMargin={8}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'Inter' }}
          axisLine={false} tickLine={false} tickMargin={4}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone" dataKey="count"
          stroke={VIOLET} strokeWidth={1.5}
          fill="url(#violetGrad)"
          activeDot={{ r: 4, strokeWidth: 0, fill: VIOLET }}
        />
        <Brush
          dataKey="displayDate" height={22}
          stroke={VIOLET} fill="rgba(0,0,0,0.6)"
          tickFormatter={() => ''}
          onChange={handleBrushChange}
          travellerWidth={6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
