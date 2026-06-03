"use client";

import { AppShell } from "@/components/app-shell";
import { mockReservations } from "@/lib/mock-data";
import { yearlyDaysByUser } from "@/lib/reservation-utils";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

export default function StatsPage() {
  const year = new Date().getFullYear();
  const grouped = yearlyDaysByUser(mockReservations, year);
  const chartData = Object.entries(grouped).map(([name, days]) => ({ name, days }));

  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Yearly Stay Stats</h2>
        <p className="mt-2 text-sm text-slate-600">Total number of apartment days visited per user for {year}.</p>

        <div className="mt-8 overflow-x-auto">
          <BarChart width={920} height={340} data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="days" fill="#92400e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </div>
      </section>
    </AppShell>
  );
}
