import { useState, useEffect } from "react";
import { LayoutDashboard, LineChart, Sparkles, Moon, Sun } from "lucide-react";
import Dashboard from "./components/Dashboard";
import PredictionForm from "./components/PredictionForm";
import ModelInsights from "./components/ModelInsights";

type Tab = "dashboard" | "predict" | "insights";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export { API_BASE };

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const tabs: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "predict", label: "Predict", icon: LineChart },
    { key: "insights", label: "Model Insights", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Air Quality Monitor
            </h1>
            <p className="text-xs text-muted-foreground">
              Athens · Ancona · Zaragoza
            </p>
          </div>
          <div className="flex items-center gap-1">
            <nav className="flex gap-1 rounded-lg bg-muted/50 p-1">
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              onClick={() => setDark((d) => !d)}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-fade-in-up" key={activeTab}>
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "predict" && <PredictionForm />}
          {activeTab === "insights" && <ModelInsights />}
        </div>
      </main>
    </div>
  );
}

export default App;
