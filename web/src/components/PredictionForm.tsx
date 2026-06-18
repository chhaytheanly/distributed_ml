import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface PredictionResult {
  pm10_prediction: number;
  pm25_prediction: number;
  o3_prediction: number;
}

const CITIES = ["athens", "ancona", "zaragoza"];
const SEASONS = ["spring", "summer", "fall", "winter"];

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
      const res = await fetch("/api/predict", {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Input Features</CardTitle>
          <CardDescription>
            Enter sensor readings and environmental factors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <select
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <select
                  id="season"
                  value={form.season}
                  onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {SEASONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp">Temp (°C)</Label>
                <Input
                  id="temp"
                  type="number"
                  value={form.temp}
                  onChange={(e) => handleChange("temp", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="humidity">Humidity (%)</Label>
                <Input
                  id="humidity"
                  type="number"
                  value={form.relative_humidity}
                  onChange={(e) => handleChange("relative_humidity", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm10">PM10 (µg/m³)</Label>
                <Input
                  id="pm10"
                  type="number"
                  value={form.pm10}
                  onChange={(e) => handleChange("pm10", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm25">PM2.5 (µg/m³)</Label>
                <Input
                  id="pm25"
                  type="number"
                  value={form.pm2_5}
                  onChange={(e) => handleChange("pm2_5", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no2">NO₂ (ppb)</Label>
                <Input
                  id="no2"
                  type="number"
                  value={form.no2}
                  onChange={(e) => handleChange("no2", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o3">O₃ (ppb)</Label>
                <Input
                  id="o3"
                  type="number"
                  value={form.o3}
                  onChange={(e) => handleChange("o3", e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Predicting..." : "Run Prediction"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Prediction Results</CardTitle>
              <CardDescription>
                Forecasted pollutant levels for the next 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "PM10 (24h mean)", value: result.pm10_prediction, unit: "µg/m³" },
                  { label: "PM2.5 (24h mean)", value: result.pm25_prediction, unit: "µg/m³" },
                  { label: "O₃ (24h max)", value: result.o3_prediction, unit: "ppb" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                  >
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-lg font-bold tabular-nums text-foreground">
                      {item.value.toFixed(1)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.unit}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
