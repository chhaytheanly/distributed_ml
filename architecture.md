# Architecture: Parallel-Distribute — Air Quality ML Pipeline

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE ORCHESTRATION                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  spark-master  │  spark-worker-1  │  spark-worker-2  │  postgres  │  pgadmin │
│  (Apache Spark │  (Spark Worker)  │  (Spark Worker)  │ (PostgreSQL│  (Admin  │
│   Master)      │  2 cores / 2g)  │  2 cores / 2g)   │  16)       │  UI)     │
│                │                  │                   │            │          │
│  spark-submit ─── runs the PySpark pipeline                                  │
│  api (FastAPI) ─ CPU-only, serves model predictions                          │
│  web (Vite+Nginx) ─ React/Tailwind dashboard                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

An end-to-end air quality pipeline that ingests CSV data from three European cities (Athens, Ancona, Zaragoza), unifies/cleans it, engineers ML-ready features, trains predictive models (PySpark MLlib GBT + PyTorch MLP), and serves predictions via a FastAPI backend with a React dashboard.

## Pipeline Stages

### Stage 0: Database Schema Initialization
**`src/sql/init.sql`**
- Creates `raw` schema with `raw.air_quality` table (21 columns)
- Creates `ml` schema with `ml.air_quality_ready` table (47 columns)
- Indexes on `date`, `station_name`, `city`

### Stage 1: ETL — Load, Unify, Clean (Spark)
**`src/etl/spark_etl.py` → `load_and_unify()`**

| City     | Has PM2.5? | Has code/id? | Temp Unit |
|----------|------------|--------------|-----------|
| athens   | Yes        | Yes          | Celsius   |
| ancona   | Yes        | Yes          | Fahrenheit|
| zaragoza | No         | No           | Celsius   |

1. Read three city-specific CSVs
2. Rename columns to canonical names
3. Add missing columns (Zaragoza gets null PM2.5)
4. `unionByName` into unified DataFrame
5. Convert Ancona temperatures Fahrenheit → Celsius
6. Impute Zaragoza PM2.5 using learned PM2.5/PM10 ratio from Athens+Ancona
7. Parse timestamps, filter fully-null pollutant rows, median-impute remaining nulls
8. Write to PostgreSQL `raw.air_quality` via JDBC

### Stage 2: Feature Engineering (Spark)
**`src/etl/feature_engineering.py` → `build_ml_dataset()`**

Six sequential transforms applied via Spark DataFrame operations:

| Transform | What it does |
|-----------|-------------|
| **Temporal** | `year`, `month`, `day`, `hour`, `day_of_week`, `is_weekend`, `season` |
| **Weather** | Wind speed (`sqrt(U²+V²)`), wind direction (`atan2`), temp-dewpoint spread, temp-soil diff |
| **Pollutant Ratios** | `pm10_pm25_ratio`, `no2_o3_balance` |
| **Rolling 24h** | `rowsBetween(-23, 0)` → means for PM10/PM2.5/NO2/O3, max for O3 |
| **Lag Features** | `lag(pollutant, N)` for N=1,2,3 on PM10/PM2.5/NO2/O3 |
| **Targets** | `rowsBetween(1, 24)` → `pm10_next_24h_mean`, `pm25_next_24h_mean`, `o3_next_24h_max` |

**Outputs** (written by `write_ml_dataset()`):
- PostgreSQL `ml.air_quality_ready`
- Parquet at `output/ml_air_quality.parquet/`
- Single CSV at `output/ml_air_quality.csv/`

### Stage 3a: Model Training — PySpark GBT
**README path** (reference only)
- Three `GBTRegressor` models (one per target: PM10, PM2.5, O3)

### Stage 3b: Model Training — PyTorch MLP
**`src/model/train.py` + `src/model/mlp_model.py`**

**`AirQualityMLP` architecture:**

| Layer | Size | Details |
|-------|------|---------|
| 0     | →256 | Linear |
| 1-3   | 256  | BN → ReLU → Dropout(0.3) |
| 4     | →128 | Linear |
| 5-7   | 128  | BN → ReLU → Dropout(0.2) |
| 8     | →64  | Linear → ReLU |
| 9     | →32  | Linear → ReLU |
| 10    | →3   | Linear (PM10, PM2.5, O3) |

- Adam (lr=1e-3), ReduceLROnPlateau, MSELoss, batch_size=64, max_epochs=200, early stopping patience=10
- **Outputs:** `mlp_model.pt` (TorchScript), `mlp_state.pth`, `scaler.pkl`, `feature_columns.pkl`, `metrics.txt`

### Stage 4: API Service (FastAPI)
**`src/api/main.py`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/data/summary` | GET | Per-city aggregates (avg PM10/PM2.5/NO2/O3, count) |
| `/predict` | POST | Accepts readings → builds 38-feature vector → scales → infers → returns 3 predictions |

- Simpler MLP in API: 512→256→128→64→3 (no BatchNorm/Dropout)
- Reconstructs rolling/lag features from single input snapshot (approximation)

### Stage 5: Web Dashboard (Vite + React + TypeScript + Tailwind)
**`web/`**

| Component | Function |
|-----------|----------|
| `Dashboard.tsx` | Summary cards (AQI), bar chart, radar chart via Recharts |
| `PredictionForm.tsx` | Sensor input form → POST `/predict` → displays AQI-badged results |
| `ModelInsights.tsx` | Static model architecture info |
| `lib/air-quality.ts` | EPA-standard AQI classification logic |

- Nginx reverse-proxies `/api/` → FastAPI backend

## Data Flow

```
[CSV Files] ──→ [Spark ETL] ──→ [PostgreSQL raw.air_quality]
                                        │
                                        ▼
                                [Spark Feature Engineering]
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            [PostgreSQL           [Parquet]            [CSV]
            ml.air_quality_ready]
                    │                   │
                    │                   ▼
                    │           [PyTorch Training]
                    │                   │
                    │           [Model Artifacts]
                    │
                    ▼
            [FastAPI Service]
                    │
            ┌───────┴───────┐
            ▼               ▼
     [/predict]       [/data/summary]
            │               │
            └───────┬───────┘
                    ▼
            [React Dashboard]
```

## Parallelism Strategy

| Layer | Mechanism | Resources |
|-------|-----------|-----------|
| **Spark** | 1 master + 2 workers, shuffle partitions=8, AQE enabled | 4 cores / 4GB total executor memory |
| **Window functions** | Partitioned by `station_name` → parallel per-station time-series processing | Spark distributes across executors |
| **PyTorch** | Single-node CPU-only, DataLoader batch_size=64 | No GPU |
| **FastAPI** | Single uvicorn process | Sequential inference |
| **Web** | Client-side React (no SSR) | Browser |

## Key Design Observations

1. **Two training paths coexist** — README describes PySpark GBT; actual code implements PyTorch MLP.
2. **API feature approximation** — rolling/lag features are approximated from single-input snapshot (no history).
3. **Idempotent steps** — all writes use `mode("overwrite")`.
4. **No GPU** — all PyTorch uses `--index-url https://download.pytorch.org/whl/cpu`.
5. **No explicit caching/checkpointing** — only persisted states are PostgreSQL tables and Parquet/CSV files.

## Port Map

| Port | Service |
|------|---------|
| 7077 | Spark Master cluster |
| 8080 | Spark Master Web UI |
| 8081-8082 | Spark Worker Web UIs |
| 4040 | Active Spark job UI |
| 4321 | PostgreSQL |
| 5050 | pgAdmin |
| 8000 | FastAPI |
| 3000 | Web Dashboard (Nginx) |
