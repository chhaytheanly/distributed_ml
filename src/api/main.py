import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pyspark.ml import PipelineModel
from pyspark.sql import SparkSession

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


# ── Model loading ───────────────────────────────────────────────────────────

class ModelService:
    def __init__(self):
        self.spark: Optional[SparkSession] = None
        self.models: dict[str, PipelineModel] = {}

    def load(self):
        output_dir = os.getenv("OUTPUT_DIR", "/workspace/output")
        self.spark = SparkSession.builder \
            .appName("AirQualityAPI") \
            .master("local[*]") \
            .config("spark.sql.shuffle.partitions", "2") \
            .getOrCreate()

        targets = {"pm10": "pm10_next_24h_mean",
                   "pm25": "pm25_next_24h_mean",
                   "o3": "o3_next_24h_max"}

        for key, target in targets.items():
            path = os.path.join(output_dir, f"gbt_{key}")
            if os.path.exists(path):
                self.models[key] = PipelineModel.load(path)
                print(f"[API] Loaded model: {key}")
            else:
                print(f"[API] WARNING: Model not found at {path}")

    def predict(self, inp: PredictionInput) -> PredictionOutput:
        data = {
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
            "city": inp.city,
            "season": inp.season,
            "year": 2020,
            "month": inp.month,
            "day": 15,
            "hour": inp.hour,
            "day_of_week": inp.day_of_week,
            "is_weekend": 1 if inp.day_of_week in (1, 7) else 0,
        }

        derived = {
            "wind_speed": (inp.wind_speed_u ** 2 + inp.wind_speed_v ** 2) ** 0.5,
            "wind_direction": 0.0,
            "temp_dewpoint_spread": inp.temp - inp.dewpoint_temp,
            "temp_soil_diff": inp.temp - inp.soil_temp,
        }
        data.update(derived)

        ratios = {
            "pm10_pm25_ratio": inp.pm10 / inp.pm2_5 if inp.pm2_5 > 0 else 0.0,
            "no2_o3_balance": inp.no2 / inp.o3 if inp.o3 > 0 else 0.0,
        }
        data.update(ratios)

        null_features = [
            "pm10_roll_24h_mean", "pm25_roll_24h_mean",
            "no2_roll_24h_mean", "o3_roll_24h_mean", "o3_roll_24h_max",
            "pm10_lag1", "pm10_lag2", "pm10_lag3",
            "pm25_lag1", "pm25_lag2", "pm25_lag3",
            "no2_lag1", "no2_lag2", "no2_lag3",
            "o3_lag1", "o3_lag2", "o3_lag3",
        ]
        for col_name in null_features:
            data[col_name] = None

        pdf = pd.DataFrame([data])
        sdf = self.spark.createDataFrame(pdf)

        results = {}
        for key in ("pm10", "pm25", "o3"):
            if key in self.models:
                pred_df = self.models[key].transform(sdf)
                results[key] = float(pred_df.select("prediction").collect()[0][0])
            else:
                results[key] = 0.0

        return PredictionOutput(
            pm10_prediction=results["pm10"],
            pm25_prediction=results["pm25"],
            o3_prediction=results["o3"],
        )

    def cleanup(self):
        if self.spark:
            self.spark.stop()


model_service = ModelService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_service.load()
    yield
    model_service.cleanup()


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
    try:
        spark = SparkSession.builder \
            .appName("AirQualitySummary") \
            .master("local[*]") \
            .config("spark.sql.shuffle.partitions", "2") \
            .getOrCreate()

        props = {
            "url": os.getenv("POSTGRES_URL", "jdbc:postgresql://postgres:5432/dist_f1"),
            "user": os.getenv("POSTGRES_USER", "root"),
            "password": os.getenv("POSTGRES_PASSWORD", "root168"),
            "driver": "org.postgresql.Driver",
        }

        df = spark.read.jdbc(props["url"], "raw.air_quality", properties=props)

        from pyspark.sql.functions import avg, count

        summary = (
            df.groupBy("city")
            .agg(
                avg("pm10").alias("avg_pm10"),
                avg("pm2_5").alias("avg_pm25"),
                avg("no2").alias("avg_no2"),
                avg("o3").alias("avg_o3"),
                count("*").alias("count"),
            )
            .collect()
        )

        spark.stop()

        return [
            {
                "city": row["city"],
                "avg_pm10": round(float(row["avg_pm10"]), 2),
                "avg_pm25": round(float(row["avg_pm25"]), 2),
                "avg_no2": round(float(row["avg_no2"]), 2),
                "avg_o3": round(float(row["avg_o3"]), 2),
                "count": row["count"],
            }
            for row in summary
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict", response_model=PredictionOutput)
def predict(inp: PredictionInput):
    try:
        return model_service.predict(inp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
