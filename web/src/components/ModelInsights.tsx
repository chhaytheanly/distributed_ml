import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Brain, Layers, Target, Sparkles } from "lucide-react";

const ARCH_LAYERS = [
  { from: "48", to: "512", label: "Input → 512" },
  { from: "512", to: "256", label: "512 → 256" },
  { from: "256", to: "128", label: "256 → 128" },
  { from: "128", to: "64", label: "128 → 64" },
  { from: "64", to: "3", label: "64 → Output (3)" },
];

export default function ModelInsights() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h2 className="text-lg font-semibold text-foreground">Model Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PyTorch Multi-Layer Perceptron (MLP) with 4 hidden layers trained to predict
          24-hour mean PM10, PM2.5, and max O3 concentrations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Brain, label: "Algorithm", value: "PyTorch MLP", gradient: "from-blue-400 to-blue-600", delay: "animate-stagger-1" },
          { icon: Layers, label: "Features", value: "48", gradient: "from-emerald-400 to-emerald-600", delay: "animate-stagger-2" },
          { icon: Target, label: "Targets", value: "3", gradient: "from-purple-400 to-purple-600", delay: "animate-stagger-3" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`glass glass-hover animate-fade-in-up ${stat.delay} group`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardDescription className="text-xs">{stat.label}</CardDescription>
                    <CardTitle className="text-2xl font-bold tracking-tight">{stat.value}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass animate-fade-in-up animate-stagger-3">
          <CardHeader>
            <CardTitle>Architecture</CardTitle>
            <CardDescription>5-layer fully connected neural network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2">
              {ARCH_LAYERS.map((layer, i) => (
                <div key={i} className="flex flex-col items-center w-full">
                  <div className="w-full rounded-xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/10 px-4 py-2.5 text-center">
                    <span className="text-sm font-mono font-medium text-foreground">
                      Linear({layer.from}, {layer.to})
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{layer.label}</span>
                  </div>
                  {i < ARCH_LAYERS.length - 1 && (
                    <div className="flex items-center gap-1 py-1">
                      <div className="h-5 w-px bg-border/40" />
                      <span className="text-[10px] font-mono text-muted-foreground px-1">ReLU</span>
                      <div className="h-5 w-px bg-border/40" />
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Total: ~343k parameters · ReLU activations · Input scaled via StandardScaler
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass animate-fade-in-up animate-stagger-3">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
            <CardDescription>Make predictions via the REST API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Endpoint</p>
              <div className="rounded-xl bg-muted/40 border border-border/30 px-3 py-2">
                <code className="text-xs font-mono text-primary">POST /predict</code>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Request body (JSON)</p>
              <div className="rounded-xl bg-muted/40 border border-border/30 p-3 overflow-x-auto">
                <pre className="text-[10px] font-mono text-foreground leading-relaxed">{`{
  "city": "athens",
  "season": "spring",
  "temp": 20,
  "relative_humidity": 60,
  "pm10": 25,
  "pm2_5": 12,
  "no2": 20,
  "o3": 50,
  "hour": 12,
  "day_of_week": 3,
  "month": 5
}`}</pre>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Response</p>
              <div className="rounded-xl bg-muted/40 border border-border/30 p-3">
                <pre className="text-[10px] font-mono text-foreground leading-relaxed">{`{
  "pm10_prediction": 22.45,
  "pm25_prediction": 12.18,
  "o3_prediction": 48.32
}`}</pre>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The API expands your 19 input fields into <strong className="text-foreground">48 features</strong> internally —
              including one-hot encoded city/season, derived weather metrics, pollutant ratios,
              rolling 24h means, and lag features — then runs them through the trained MLP.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass animate-fade-in-up animate-stagger-4">
          <CardHeader>
            <CardTitle>Feature Categories (48 total)</CardTitle>
            <CardDescription>
              The features engineered from 19 input fields before inference
            </CardDescription>
          </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Raw Sensor Inputs", features: "temp, humidity, wind_u/v, dewpoint, soil_temp, precipitation, vegetation, pm10, pm2.5, no2, o3" },
              { name: "Temporal", features: "year, month, day, hour, day_of_week, is_weekend, season (one-hot)" },
              { name: "Weather-derived", features: "wind_speed, wind_direction, temp_dewpoint_spread, temp_soil_diff" },
              { name: "Pollutant Ratios", features: "pm10_pm25_ratio, no2_o3_balance" },
              { name: "Rolling 24h (approx)", features: "pm10/p m2.5/no2/o3 mean, o3 max" },
              { name: "Lag features (t-1..3)", features: "pm10, pm2.5, no2, o3 lagged values" },
              { name: "City (one-hot)", features: "city_athens, city_ancona, city_zaragoza" },
              { name: "Location", features: "latitude, longitude" },
            ].map((cat, idx) => (
              <div
                key={cat.name}
                className="rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30 p-4 transition-all duration-200 hover:shadow-md hover:border-border/60"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-foreground">{cat.name}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{cat.features}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass animate-fade-in-up animate-stagger-4">
        <CardHeader>
          <CardTitle>Prediction Targets</CardTitle>
          <CardDescription>
            The three air quality metrics predicted by the model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Target</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Description</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  { name: "PM10", desc: "Next 24-hour mean PM10 (µg/m³)", type: "Regression" },
                  { name: "PM2.5", desc: "Next 24-hour mean PM2.5 (µg/m³)", type: "Regression" },
                  { name: "O₃", desc: "Next 24-hour max O₃ (ppb)", type: "Regression" },
                ].map((t) => (
                  <tr key={t.name} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.desc}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] font-semibold">{t.type}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
