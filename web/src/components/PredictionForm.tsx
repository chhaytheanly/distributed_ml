import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { API_BASE } from "../App";
import { Badge } from "./ui/badge";
import { classifyPM25, classifyPM10, classifyO3 } from "../lib/air-quality";
import { LineChart, AlertCircle, CheckCircle2, MapPin, CloudSun, Wind } from "lucide-react";

interface PredictionResult {
  pm10_prediction: number;
  pm25_prediction: number;
  o3_prediction: number;
}

const CITIES = ["athens", "ancona", "zaragoza"];
const SEASONS = ["spring", "summer", "fall", "winter"];

interface FieldGroup {
  label: string;
  icon: typeof MapPin;
  fields: { key: string; label: string; colSpan?: boolean }[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Location & Time",
    icon: MapPin,
    fields: [
      { key: "city", label: "City" },
      { key: "season", label: "Season" },
      { key: "hour", label: "Hour (0–23)" },
      { key: "month", label: "Month (1–12)" },
    ],
  },
  {
    label: "Weather",
    icon: CloudSun,
    fields: [
      { key: "temp", label: "Temperature (°C)", colSpan: true },
      { key: "relative_humidity", label: "Humidity (%)" },
      { key: "dewpoint_temp", label: "Dewpoint (°C)" },
      { key: "soil_temp", label: "Soil Temp (°C)" },
      { key: "wind_speed_u", label: "Wind U (m/s)" },
      { key: "wind_speed_v", label: "Wind V (m/s)" },
      { key: "total_percipitation", label: "Precipitation (mm)", colSpan: true },
    ],
  },
  {
    label: "Pollutant Readings",
    icon: Wind,
    fields: [
      { key: "pm10", label: "PM10 (µg/m³)" },
      { key: "pm2_5", label: "PM2.5 (µg/m³)" },
      { key: "no2", label: "NO₂ (ppb)" },
      { key: "o3", label: "O₃ (ppb)" },
    ],
  },
];

export default function PredictionForm() {
  const [form, setForm] = useState({
    city: "athens",
    season: "spring",
    temp: 20,
    relative_humidity: 60,
    pm10: 25,
    pm2_5: 12,
    no2: 20,
    o3: 50,
    wind_speed_u: 0,
    wind_speed_v: 0,
    dewpoint_temp: 10,
    soil_temp: 15,
    total_percipitation: 0,
    vegetation_high: 1.7,
    vegetation_low: 1.5,
    hour: 12,
    day_of_week: 3,
    month: 6,
  });

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string, value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setForm((prev) => ({ ...prev, [field]: isNaN(num) ? value : num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Prediction failed");
      }

      const data: PredictionResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const resultItems = result
    ? [
        { label: "PM10 (24h mean)", value: result.pm10_prediction, unit: "µg/m³", classify: classifyPM10 },
        { label: "PM2.5 (24h mean)", value: result.pm25_prediction, unit: "µg/m³", classify: classifyPM25 },
        { label: "O₃ (24h max)", value: result.o3_prediction, unit: "ppb", classify: classifyO3 },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3 glass glass-hover">
        <CardHeader>
          <CardTitle>Input Features</CardTitle>
          <CardDescription>
            Enter sensor readings and environmental factors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {FIELD_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {group.fields.map((f) => {
                      if (f.key === "city" || f.key === "season") {
                        const options = f.key === "city" ? CITIES : SEASONS;
                        return (
                          <div
                            key={f.key}
                            className={`space-y-1.5 ${f.colSpan ? "col-span-2" : ""}`}
                          >
                            <Label htmlFor={f.key} className="text-xs font-medium">{f.label}</Label>
                            <select
                              id={f.key}
                              value={String(form[f.key as keyof typeof form])}
                              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                              className="flex h-10 w-full rounded-xl border border-input/60 bg-background/50 px-3 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                            >
                              {options.map((o) => (
                                <option key={o} value={o}>
                                  {o.charAt(0).toUpperCase() + o.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={f.key}
                          className={`space-y-1.5 ${f.colSpan ? "col-span-2" : ""}`}
                        >
                          <Label htmlFor={f.key} className="text-xs font-medium">{f.label}</Label>
                          <Input
                            id={f.key}
                            type="number"
                            step="any"
                            value={String(form[f.key as keyof typeof form])}
                            onChange={(e) => handleChange(f.key, e.target.value)}
                            className="h-10 rounded-xl border-input/60 bg-background/50 backdrop-blur-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Predicting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  Run Prediction
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {result && (
          <Card className="glass animate-scale-in">
              <CardHeader>
                <CardTitle>Prediction Results</CardTitle>
                <CardDescription>
                  Forecasted pollutant levels for the next 24 hours
                </CardDescription>
              </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resultItems.map((item, idx) => {
                  const aqi = item.classify(item.value);
                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/30 p-4 transition-all duration-200 hover:shadow-md animate-fade-in-up"
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          {aqi.level === "good" || aqi.level === "moderate" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: aqi.color }} />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5" style={{ color: aqi.color }} />
                          )}
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
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-2xl font-bold tabular-nums tracking-tight transition-all duration-200"
                          style={{ color: aqi.color }}
                        >
                          {item.value.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.unit}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: aqi.color }}>
                        {aqi.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {!result && !error && (
          <Card className="glass h-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400/10 to-purple-400/10 mb-4">
                <LineChart className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Fill in the form and run a prediction<br />to see results here
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive backdrop-blur-sm animate-scale-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
