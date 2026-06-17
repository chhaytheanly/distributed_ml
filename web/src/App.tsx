import { useState } from "react";
import Dashboard from "./components/Dashboard";
import PredictionForm from "./components/PredictionForm";
import ModelInsights from "./components/ModelInsights";

type Tab = "dashboard" | "predict" | "insights";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export { API_BASE };

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "predict", label: "Predict" },
    { key: "insights", label: "Model Insights" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              Air Quality Monitor
            </h1>
            <p className="text-sm text-zinc-500">
              Athens · Ancona · Zaragoza
            </p>
          </div>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.key
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "predict" && <PredictionForm />}
        {activeTab === "insights" && <ModelInsights />}
      </main>
    </div>
  );
}

export default App;
