"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  data: Array<{ name: string; days: number }>;
  year: number;
};

export function StatsChart({ data, year }: Props) {
  if (data.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-500">No reservation data for {year}.</p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <BarChart
        width={920}
        height={340}
        data={data}
        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="days" name="Nights" fill="#92400e" radius={[8, 8, 0, 0]} />
      </BarChart>
    </div>
  );
}
