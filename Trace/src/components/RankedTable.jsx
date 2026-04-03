export default function RankedTable({ data, columns, onRowClick }) {
  if (!data || data.length === 0) {
    return <div className="flex h-full w-full items-center justify-center text-white/15 text-xs p-4">No data</div>;
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr>
          <th className="py-2 px-4 text-[10px] font-medium text-white/20 uppercase tracking-widest border-b border-white/[0.05] w-10 text-center">#</th>
          {columns.map((col, i) => (
            <th key={i} className={`py-2 px-3 text-[10px] font-medium text-white/20 uppercase tracking-widest border-b border-white/[0.05] ${i === columns.length - 1 ? 'text-right pr-4' : ''}`}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr
            key={idx}
            onClick={() => onRowClick?.(row)}
            className={`border-b border-white/[0.04] last:border-0 transition-colors duration-100 ${onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
          >
            <td className="py-2.5 px-4 text-center" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
              {idx + 1}
            </td>
            {columns.map((col, ci) => (
              <td key={ci} className={`py-2.5 px-3 text-[12px] ${ci === columns.length - 1 ? 'text-right pr-4' : ''}`}
                style={ci === columns.length - 1
                  ? { fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', fontSize: 12 }
                  : { color: 'rgba(255,255,255,0.65)' }
                }
              >
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
