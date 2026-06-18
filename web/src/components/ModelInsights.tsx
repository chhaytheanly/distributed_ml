import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

export default function ModelInsights() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Model Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gradient Boosted Trees (GBT) regression models trained per target
          using PySpark MLlib.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Algorithm</CardDescription>
            <CardTitle className="text-2xl">GBT</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Features</CardDescription>
            <CardTitle className="text-2xl">36</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Targets</CardDescription>
            <CardTitle className="text-2xl">3</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prediction Targets</CardTitle>
          <CardDescription>
            The three air quality metrics predicted by the model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Target</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Type</th>
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
                    <td className="px-4 py-2 text-muted-foreground">{t.desc}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">{t.type}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Categories</CardTitle>
          <CardDescription>
            The 36 features grouped by domain used for training
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Temporal", features: "year, month, day, hour, day_of_week, is_weekend, season" },
              { name: "Weather-derived", features: "wind_speed, wind_direction, temp_dewpoint_spread, temp_soil_diff" },
              { name: "Pollutant Ratios", features: "pm10_pm25_ratio, no2_o3_balance" },
              { name: "Rolling 24h", features: "pm10_mean, pm25_mean, no2_mean, o3_mean, o3_max" },
              { name: "Lag (t-1, t-2, t-3)", features: "pm10, pm2.5, no2, o3 lagged values" },
              { name: "Raw Sensors", features: "wind_u/v, temp, humidity, dewpoint, soil_temp, precipitation, vegetation" },
            ].map((cat) => (
              <div key={cat.name} className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-foreground">{cat.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{cat.features}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
