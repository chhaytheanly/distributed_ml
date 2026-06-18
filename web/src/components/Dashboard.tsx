import { useEffect, useState } from "react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "./ui/chart";

interface CitySummary {
  city: string;
  avg_pm10: number;
  avg_pm25: number;
  avg_no2: number;
  avg_o3: number;
  count: number;
}

const DEMO_SUMMARY: CitySummary[] = [
  { city: "Athens", avg_pm10: 28.4, avg_pm25: 15.2, avg_no2: 21.7, avg_o3: 52.3, count: 15000 },
  { city: "Ancona", avg_pm10: 22.1, avg_pm25: 11.8, avg_no2: 18.4, avg_o3: 48.9, count: 8000 },
  { city: "Zaragoza", avg_pm10: 31.6, avg_pm25: 13.5, avg_no2: 25.1, avg_o3: 55.7, count: 5000 },
];

const chartConfig = {
  avg_pm10: { label: "PM10", color: "hsl(217.2, 91.2%, 59.8%)" },
  avg_pm25: { label: "PM2.5", color: "hsl(142.1, 76.2%, 36.3%)" },
  avg_no2: { label: "NO₂", color: "hsl(24.6, 95%, 53.1%)" },
  avg_o3: { label: "O₃", color: "hsl(271, 81.3%, 55.9%)" },
} satisfies ChartConfig;

type PollutantKey = "avg_pm10" | "avg_pm25" | "avg_no2" | "avg_o3";

const pollutants: { key: PollutantKey; label: string; unit: string }[] = [
  { key: "avg_pm10", label: "PM10", unit: "µg/m³" },
  { key: "avg_pm25", label: "PM2.5", unit: "µg/m³" },
  { key: "avg_no2", label: "NO₂", unit: "ppb" },
  { key: "avg_o3", label: "O₃", unit: "ppb" },
];

export default function Dashboard() {
  const [data, setData] = useState<CitySummary[]>(DEMO_SUMMARY);

  useEffect(() => {
    fetch("/api/data/summary")
      .then((r) => r.json())
      .then((d: CitySummary[]) =>
        setData(d.map((c) => ({ ...c, city: c.city.charAt(0).toUpperCase() + c.city.slice(1) }))),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pollutants.map((p) => (
          <Card key={p.key}>
            <CardHeader className="pb-2">
              <CardDescription>{p.label}</CardDescription>
              <CardTitle className="text-sm font-normal text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.map((c) => (
                  <div key={c.city} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{c.city}</span>
                    <span className="font-medium tabular-nums">
                      {c[p.key].toFixed(1)}{" "}
                      <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pollutant Levels by City</CardTitle>
          <CardDescription>
            Average concentrations across all measurement periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px]">
            <BarChart data={data} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="city"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {pollutants.map((p) => (
                <Bar
                  key={p.key}
                  dataKey={p.key}
                  fill={`var(--color-${p.key})`}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
