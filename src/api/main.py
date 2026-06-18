import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Schemas ─────────────────────────────────────────────────────────────────

class PredictionInput(BaseModel):
    latitude: float = 38.15
    longitude: float = 23.55
    wind_speed_u: float = 0.0
    wind_speed_v: float = 0.0
    dewpoint_temp: float = 10.0
    soil_temp: float = 17.0
    total_percipitation: float = 0.0
    vegetation_high: float = 1.7
    vegetation_low: float = 1.5
    temp: float = 14.0
    relative_humidity: float = 80.0
    pm10: float = 10.0
    pm2_5: float = 6.0
    no2: float = 10.0
    o3: float = 70.0
    city: str = "athens"
    season: str = "spring"
    hour: int = 12
    day_of_week: int = 1
    month: int = 5


class PredictionOutput(BaseModel):
    pm10_prediction: float
    pm25_prediction: float
    o3_prediction: float


# ── PyTorch MLP ─────────────────────────────────────────────────────────────

class AirQualityMLP(nn.Module):
    def __init__(self, input_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 512),
            nn.ReLU(),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 3),
        )

    def forward(self, x):
        return self.net(x)


class PyTorchModelService:
    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.scaler = None
        self.feature_columns: list[str] = []
        self.target_mean: np.ndarray | None = None
        self.target_std: np.ndarray | None = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def load(self, model_dir: str | None = None):
        if model_dir is None:
            model_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "modules"
            )

        preprocess_dir = os.path.join(model_dir, "Preprocess")

        model_path = os.path.join(model_dir, "air_quality_model.pt")
        state_dict = torch.load(model_path, map_location="cpu", weights_only=False)

        input_dim = state_dict["_orig_mod.net.0.weight"].shape[1]
        self.model = AirQualityMLP(input_dim).to(self.device)

        cleaned = {}
        for k, v in state_dict.items():
            key = k.replace("_orig_mod.", "", 1) if k.startswith("_orig_mod.") else k
            cleaned[key] = v
        self.model.load_state_dict(cleaned, strict=False)
        self.model.eval()

        scaler_path = os.path.join(preprocess_dir, "scaler.pkl")
        self.scaler = joblib.load(scaler_path)

        cols_path = os.path.join(preprocess_dir, "feature_columns.pkl")
        self.feature_columns = joblib.load(cols_path)

        norm_path = os.path.join(preprocess_dir, "target_norm.pkl")
        self.target_mean, self.target_std = joblib.load(norm_path)

    def _build_features(self, inp: PredictionInput) -> np.ndarray:
        row = {
            "latitude": inp.latitude,
            "longitude": inp.longitude,
            "wind_speed_u": inp.wind_speed_u,
            "wind_speed_v": inp.wind_speed_v,
            "dewpoint_temp": inp.dewpoint_temp,
            "soil_temp": inp.soil_temp,
            "total_percipitation": inp.total_percipitation,
            "vegetation_high": inp.vegetation_high,
            "vegetation_low": inp.vegetation_low,
            "temp": inp.temp,
            "relative_humidity": inp.relative_humidity,
            "pm10": inp.pm10,
            "pm2_5": inp.pm2_5,
            "no2": inp.no2,
            "o3": inp.o3,
            "year": 2020,
            "month": inp.month,
            "day": 15,
            "hour": inp.hour,
            "day_of_week": inp.day_of_week,
            "is_weekend": 1 if inp.day_of_week in (1, 7) else 0,
            "wind_speed": (inp.wind_speed_u ** 2 + inp.wind_speed_v ** 2) ** 0.5,
            "wind_direction": 0.0,
            "temp_dewpoint_spread": inp.temp - inp.dewpoint_temp,
            "temp_soil_diff": inp.temp - inp.soil_temp,
            "pm10_pm25_ratio": inp.pm10 / inp.pm2_5 if inp.pm2_5 > 0 else 0.0,
            "no2_o3_balance": inp.no2 / inp.o3 if inp.o3 > 0 else 0.0,
            # Rolling features — approximate with current values
            "pm10_roll_24h_mean": inp.pm10,
            "pm25_roll_24h_mean": inp.pm2_5,
            "no2_roll_24h_mean": inp.no2,
            "o3_roll_24h_mean": inp.o3,
            "o3_roll_24h_max": inp.o3,
            # Lag features — approximate with current values
            "pm10_lag1": inp.pm10,
            "pm10_lag2": inp.pm10,
            "pm10_lag3": inp.pm10,
            "pm25_lag1": inp.pm2_5,
            "pm25_lag2": inp.pm2_5,
            "pm25_lag3": inp.pm2_5,
            "no2_lag1": inp.no2,
            "no2_lag2": inp.no2,
            "no2_lag3": inp.no2,
            "o3_lag1": inp.o3,
            "o3_lag2": inp.o3,
            "o3_lag3": inp.o3,
        }

        for c in ["ancona", "athens", "zaragoza"]:
            row[f"city_{c}"] = 1.0 if inp.city == c else 0.0
        for s in ["fall", "spring", "summer", "winter"]:
            row[f"season_{s}"] = 1.0 if inp.season == s else 0.0

        arr = np.array([row[c] for c in self.feature_columns], dtype=np.float32)
        return arr.reshape(1, -1)

    @torch.no_grad()
    def predict(self, inp: PredictionInput) -> PredictionOutput:
        features = self._build_features(inp)
        features_scaled = self.scaler.transform(features)

        tensor = torch.tensor(features_scaled, dtype=torch.float32, device=self.device)
        preds = self.model(tensor).cpu().numpy().flatten()

        preds = preds * self.target_std + self.target_mean

        return PredictionOutput(
            pm10_prediction=float(preds[0]),
            pm25_prediction=float(preds[1]),
            o3_prediction=float(preds[2]),
        )


# ── Services ────────────────────────────────────────────────────────────────

torch_service = PyTorchModelService()

_data_summary_cache: list[dict] | None = None


def _load_data_summary() -> list[dict]:
    global _data_summary_cache
    if _data_summary_cache is not None:
        return _data_summary_cache

    output_dir = os.getenv("OUTPUT_DIR")
    if output_dir:
        parquet_dir = os.path.join(output_dir, "ml_air_quality.parquet")
    else:
        # Fallback: look relative to the project root
        script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        parquet_dir = os.path.join(script_dir, "..", "output", "ml_air_quality.parquet")
        if not os.path.isdir(parquet_dir):
            parquet_dir = os.path.join(script_dir, "..", "..", "output", "ml_air_quality.parquet")

    if not os.path.isdir(parquet_dir):
        raise HTTPException(
            status_code=503,
            detail=f"Data summary unavailable — parquet data not found at {parquet_dir}"
        )

    df = pd.read_parquet(parquet_dir)
    summary = (
        df.groupby("city")
        .agg(
            avg_pm10=("pm10", "mean"),
            avg_pm25=("pm2_5", "mean"),
            avg_no2=("no2", "mean"),
            avg_o3=("o3", "mean"),
            count=("pm10", "count"),
        )
        .reset_index()
    )

    _data_summary_cache = [
        {
            "city": row["city"],
            "avg_pm10": round(float(row["avg_pm10"]), 2),
            "avg_pm25": round(float(row["avg_pm25"]), 2),
            "avg_no2": round(float(row["avg_no2"]), 2),
            "avg_o3": round(float(row["avg_o3"]), 2),
            "count": int(row["count"]),
        }
        for _, row in summary.iterrows()
    ]
    return _data_summary_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    torch_service.load()
    yield


app = FastAPI(title="Air Quality ML API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/data/summary")
def data_summary():
    return _load_data_summary()


@app.post("/predict", response_model=PredictionOutput)
def predict(inp: PredictionInput):
    try:
        return torch_service.predict(inp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
