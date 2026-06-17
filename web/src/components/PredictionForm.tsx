import { useState } from "react";

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
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-800">
          Input Features
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-600">City</label>
              <select
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-600">Season</label>
              <select
                value={form.season}
                onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                Temp (°C)
              </label>
              <input
                type="number"
                value={form.temp}
                onChange={(e) => handleChange("temp", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                Humidity (%)
              </label>
              <input
                type="number"
                value={form.relative_humidity}
                onChange={(e) => handleChange("relative_humidity", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                PM10 (µg/m³)
              </label>
              <input
                type="number"
                value={form.pm10}
                onChange={(e) => handleChange("pm10", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                PM2.5 (µg/m³)
              </label>
              <input
                type="number"
                value={form.pm2_5}
                onChange={(e) => handleChange("pm2_5", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                NO₂ (ppb)
              </label>
              <input
                type="number"
                value={form.no2}
                onChange={(e) => handleChange("no2", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600">
                O₃ (ppb)
              </label>
              <input
                type="number"
                value={form.o3}
                onChange={(e) => handleChange("o3", e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Predicting..." : "Run Prediction"}
          </button>
        </form>
      </div>

      <div>
        {result && (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-800">
              Prediction Results
            </h2>
            <div className="space-y-4">
              {[
                { label: "PM10 (24h mean)", value: result.pm10_prediction, unit: "µg/m³" },
                { label: "PM2.5 (24h mean)", value: result.pm25_prediction, unit: "µg/m³" },
                { label: "O₃ (24h max)", value: result.o3_prediction, unit: "ppb" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-4 py-3"
                >
                  <span className="text-sm text-zinc-600">{item.label}</span>
                  <span className="text-lg font-bold text-zinc-900">
                    {item.value.toFixed(1)}{" "}
                    <span className="text-sm font-normal text-zinc-400">
                      {item.unit}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
