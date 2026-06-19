import { useEffect, useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
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
import { Badge } from "./ui/badge";
import { Wind, Cloud, Activity, Thermometer } from "lucide-react";
import { API_BASE } from "../App";
import { classifyPollutant } from "../lib/air-quality";

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

const POLLUTANTS = [
  { key: "avg_pm10" as const, label: "PM10", unit: "µg/m³", icon: Wind, color: "hsl(217.2, 91.2%, 59.8%)", gradient: "from-blue-400 to-blue-600" },
  { key: "avg_pm25" as const, label: "PM2.5", unit: "µg/m³", icon: Cloud, color: "hsl(142.1, 76.2%, 36.3%)", gradient: "from-emerald-400 to-emerald-600" },
  { key: "avg_no2" as const, label: "NO₂", unit: "ppb", icon: Activity, color: "hsl(24.6, 95%, 53.1%)", gradient: "from-orange-400 to-orange-600" },
  { key: "avg_o3" as const, label: "O₃", unit: "ppb", icon: Thermometer, color: "hsl(271, 81.3%, 55.9%)", gradient: "from-purple-400 to-purple-600" },
];

type PollutantKey = (typeof POLLUTANTS)[number]["key"];

export default function Dashboard() {
  const [data, setData] = useState<CitySummary[]>(DEMO_SUMMARY);
  const [selectedPollutants, setSelectedPollutants] = useState<PollutantKey[]>(
    POLLUTANTS.map((p) => p.key)
  );

  useEffect(() => {
    fetch(`${API_BASE}/data/summary`)
      .then((r) => r.json())
      .then((d: CitySummary[]) =>
        setData(d.map((c) => ({ ...c, city: c.city.charAt(0).toUpperCase() + c.city.slice(1) })))
      )
      .catch(() => {});
  }, []);

  const togglePollutant = (key: PollutantKey) => {
    setSelectedPollutants((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredPollutants = POLLUTANTS.filter((p) =>
    selectedPollutants.includes(p.key)
  );

  const maxPerPollutant = useMemo(() => {
    const m: Record<string, number> = {};
    POLLUTANTS.forEach((p) => {
      m[p.key] = Math.max(...data.map((c) => c[p.key]), 1);
    });
    return m;
  }, [data]);

  const avgPerPollutant = useMemo(() => {
    const a: Record<string, number> = {};
    POLLUTANTS.forEach((p) => {
      a[p.key] = data.reduce((sum, c) => sum + c[p.key], 0) / data.length;
    });
    return a;
  }, [data]);

  const cityColors = useMemo(() => {
    const palette = [
      "hsl(217.2, 91.2%, 59.8%)",
      "hsl(142.1, 76.2%, 36.3%)",
      "hsl(24.6, 95%, 53.1%)",
    ];
    return Object.fromEntries(
      data.map((c, i) => [c.city, palette[i % palette.length]])
    );
  }, [data]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    POLLUTANTS.forEach((p) => {
      config[p.key] = { label: p.label, color: p.color };
    });
    data.forEach((c) => {
      config[c.city] = { label: c.city, color: cityColors[c.city] };
    });
    return config;
  }, [data, cityColors]);

  const radarData = useMemo(
    () =>
      POLLUTANTS.map((p) => {
        const entry: Record<string, string | number> = { pollutant: p.label };
        data.forEach((c) => {
          entry[c.city] = Number(c[p.key].toFixed(1));
        });
        return entry;
      }),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POLLUTANTS.map((p, idx) => {
          const Icon = p.icon;
          const maxVal = maxPerPollutant[p.key];
          const avgVal = avgPerPollutant[p.key];
          const aqi = classifyPollutant(p.key, avgVal);
          return (
            <Card
              key={p.key}
              className={`glass glass-hover animate-fade-in-up animate-stagger-${idx + 1} group`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${p.color}15` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: p.color }} />
                    </div>
                    <div>
                      <CardDescription className="text-xs font-medium">{p.label}</CardDescription>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          style={{
                            backgroundColor: aqi.bgColor,
                            color: aqi.color,
                            borderColor: aqi.color,
                          }}
                          variant="outline"
                          className="text-[10px] font-semibold"
                        >
                          {aqi.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          {p.unit}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-3xl font-bold tabular-nums tracking-tight transition-all duration-300 group-hover:scale-105 inline-block"
                    style={{ color: aqi.color }}
                  >
                    {avgVal.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">avg</span>
                </div>
                <p className="text-xs mt-1" style={{ color: aqi.color }}>
                  {aqi.description}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/20">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(avgVal / maxVal) * 100}%`,
                      background: `linear-gradient(90deg, ${p.color}, ${p.color}88)`,
                    }}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  {data.map((c) => {
                    const cityAqi = classifyPollutant(p.key, c[p.key]);
                    return (
                      <div key={c.city} className="flex items-center justify-between text-xs group/row">
                        <span className="w-16 text-muted-foreground font-medium">{c.city}</span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40 ring-1 ring-border/10">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${(c[p.key] / maxVal) * 100}%`,
                                background: `linear-gradient(90deg, ${cityAqi.color}, ${cityAqi.color}88)`,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right tabular-nums font-semibold text-foreground">
                            {c[p.key].toFixed(1)}
                          </span>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full transition-transform duration-200 group-hover/row:scale-125"
                            style={{ backgroundColor: cityAqi.color }}
                            title={cityAqi.label}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Show:</span>
        {POLLUTANTS.map((p) => {
          const active = selectedPollutants.includes(p.key);
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              onClick={() => togglePollutant(p.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                active
                  ? "shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              style={active ? { backgroundColor: `${p.color}15`, color: p.color } : {}}
            >
              <Icon className="h-3 w-3" />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 glass glass-hover">
          <CardHeader>
            <CardTitle>Pollutant Levels by City</CardTitle>
            <CardDescription>
              Average concentrations across all measurement periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-[300px]">
              <BarChart data={data} accessibilityLayer barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="city"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {filteredPollutants.map((p) => (
                  <Bar
                    key={p.key}
                    dataKey={p.key}
                    fill={`var(--color-${p.key})`}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 glass glass-hover">
          <CardHeader>
            <CardTitle>City Comparison</CardTitle>
            <CardDescription>Multi-pollutant profiles by city</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[300px]">
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-border/30" />
                <PolarAngleAxis
                  dataKey="pollutant"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl px-3 py-2 text-xs shadow-2xl">
                        <p className="mb-1.5 font-medium text-foreground">
                          {payload[0]?.payload?.pollutant}
                        </p>
                        {payload.map((entry) => (
                          <div key={entry.name} className="flex items-center gap-2 py-0.5">
                            <div
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="tabular-nums font-medium text-foreground">
                              {Number(entry.value).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {data.map((c) => (
                  <Radar
                    key={c.city}
                    name={c.city}
                    dataKey={c.city}
                    stroke={cityColors[c.city]}
                    fill={cityColors[c.city]}
                    fillOpacity={0.08}
                    strokeWidth={2.5}
                    animationDuration={800}
                  />
                ))}
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
