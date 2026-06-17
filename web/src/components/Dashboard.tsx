import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface CitySummary {
  city: string;
  avg_pm10: number;
  avg_pm25: number;
  avg_no2: number;
  avg_o3: number;
  count: number;
}

// Fallback demo data when API is unavailable
const DEMO_SUMMARY: CitySummary[] = [
  { city: "athens", avg_pm10: 28.4, avg_pm25: 15.2, avg_no2: 21.7, avg_o3: 52.3, count: 15000 },
  { city: "ancona", avg_pm10: 22.1, avg_pm25: 11.8, avg_no2: 18.4, avg_o3: 48.9, count: 8000 },
  { city: "zaragoza", avg_pm10: 31.6, avg_pm25: 13.5, avg_no2: 25.1, avg_o3: 55.7, count: 5000 },
];

const COLORS: Record<string, string> = {
  athens: "#2563eb",
  ancona: "#16a34a",
  zaragoza: "#ea580c",
};

export default function Dashboard() {
  const [data, setData] = useState<CitySummary[]>(DEMO_SUMMARY);

  useEffect(() => {
    fetch("/api/data/summary")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        // use fallback demo data
      });
  }, []);

  const pollutants = [
    { key: "avg_pm10", label: "PM10", unit: "µg/m³" },
    { key: "avg_pm25", label: "PM2.5", unit: "µg/m³" },
    { key: "avg_no2", label: "NO₂", unit: "ppb" },
    { key: "avg_o3", label: "O₃", unit: "ppb" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-800">
        Pollutant Averages by City
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pollutants.map((p) => (
          <div key={p.key} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">{p.label}</p>
            <div className="mt-2 space-y-1">
              {data.map((c) => (
                <div key={c.city} className="flex justify-between text-sm">
                  <span style={{ color: COLORS[c.city] }}>{c.city}</span>
                  <span className="font-medium">
                    {c[p.key as keyof CitySummary].toFixed(1)}{" "}
                    <span className="text-xs text-zinc-400">{p.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-medium text-zinc-700">
          Pollutant Levels by City
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="city" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {pollutants.map((p, i) => (
              <Bar
                key={p.key}
                dataKey={p.key}
                name={p.label}
                fill={["#3b82f6", "#22c55e", "#f97316", "#a855f7"][i]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
