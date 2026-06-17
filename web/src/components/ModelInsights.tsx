import { useEffect, useState } from "react";

interface MetricBadgeProps {
  label: string;
  value: string;
  color: string;
}

function MetricBadge({ label, value, color }: MetricBadgeProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function ModelInsights() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">Model Overview</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gradient Boosted Trees (GBT) regression models trained per target
          using PySpark MLlib.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricBadge
          label="Model Algorithm"
          value="GBT"
          color="text-zinc-900"
        />
        <MetricBadge
          label="Features"
          value="36"
          color="text-zinc-900"
        />
        <MetricBadge
          label="Targets"
          value="3"
          color="text-zinc-900"
        />
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-zinc-700">
          Prediction Targets
        </h3>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-600">Target</th>
                <th className="px-4 py-2 font-medium text-zinc-600">Description</th>
                <th className="px-4 py-2 font-medium text-zinc-600">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { name: "PM10", desc: "Next 24-hour mean PM10", type: "Regression" },
                { name: "PM2.5", desc: "Next 24-hour mean PM2.5", type: "Regression" },
                { name: "O₃", desc: "Next 24-hour max O₃", type: "Regression" },
              ].map((t) => (
                <tr key={t.name}>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.desc}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      {t.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-zinc-700">
          Feature Categories
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Temporal", features: "year, month, day, hour, day_of_week, is_weekend, season" },
            { name: "Weather-derived", features: "wind_speed, wind_direction, temp_dewpoint_spread, temp_soil_diff" },
            { name: "Pollutant Ratios", features: "pm10_pm25_ratio, no2_o3_balance" },
            { name: "Rolling 24h", features: "pm10_mean, pm25_mean, no2_mean, o3_mean, o3_max" },
            { name: "Lag (t-1, t-2, t-3)", features: "pm10, pm2.5, no2, o3 lagged values" },
            { name: "Raw Sensors", features: "wind_u/v, temp, humidity, dewpoint, soil_temp, precipitation, vegetation" },
          ].map((cat) => (
            <div key={cat.name} className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs font-medium text-zinc-700">{cat.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{cat.features}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
