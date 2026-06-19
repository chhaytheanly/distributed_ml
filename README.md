# Air Quality ML Pipeline

End-to-end air quality data pipeline — ETL, feature engineering, ML training, REST API, and web dashboard — built with **Apache Spark 3.5.3**, **PyTorch**, **FastAPI**, and **React**. Ingests CSV data from 3 European cities (Athens, Ancona, Zaragoza), unifies and cleans it, engineers a rich ML-ready feature set, trains a multi-layer perceptron (MLP) for pollutant forecasting, and serves predictions through a full-stack web application.

Outputs to **Parquet**, **CSV**, and **PostgreSQL 16**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Pipeline Stages](#pipeline-stages)
  - [Stage 0: Database Schema](#stage-0-database-schema)
  - [Stage 1: ETL — Load, Unify, Clean](#stage-1-etl--load-unify-clean)
  - [Stage 2: Feature Engineering](#stage-2-feature-engineering)
  - [Stage 3: Model Training — PyTorch MLP](#stage-3-model-training--pytorch-mlp)
  - [Stage 4: API Service — FastAPI](#stage-4-api-service--fastapi)
  - [Stage 5: Web Dashboard — React](#stage-5-web-dashboard--react)
- [Feature Engineering Deep Dive](#feature-engineering-deep-dive)
  - [Input Features Explained](#input-features-explained)
  - [Temporal Features](#1-temporal-features)
  - [Weather-Derived Features](#2-weather-derived-features)
  - [Pollutant Ratios](#3-pollutant-ratios)
  - [Rolling 24-Hour Features](#4-rolling-24-hour-features)
  - [Lag Features (t-1, t-2, t-3)](#5-lag-features-t-1-t-2-t-3)
  - [Target Variables](#6-target-variables)
  - [Final Feature Vector](#7-final-feature-vector)
- [Model Architecture](#model-architecture)
- [Outputs](#outputs)
- [Data Flow](#data-flow)
- [Parallelism Strategy](#parallelism-strategy)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Interactive Commands](#interactive-commands)
- [Accessing UIs](#accessing-uis)
- [API Reference](#api-reference)
- [Cleanup](#cleanup)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Compute | Apache Spark 3.5.3 (1 master + 2 workers) |
| ML Training | PyTorch 2.12+ (CPU) + scikit-learn |
| API | FastAPI + uvicorn |
| Database | PostgreSQL 16 |
| Admin UI | pgAdmin 4 |
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS + Recharts |
| Orchestration | Docker Compose |

---

## Project Structure

```
├── .env.example                    # Environment variable template
├── .python-version                 # Python 3.12
├── Dockerfile                      # Spark base image with Python venv & JDBC driver
├── docker-compose.yml              # Multi-service orchestration (7 containers)
├── pyproject.toml                  # Python dependencies
├── main.py                         # Local dev entrypoint
├── architecture.md                 # Detailed pipeline architecture
├── dataset/                        # 3 city CSV datasets
│   ├── athens_data.csv             # 21 cols, has PM2.5, Celsius
│   ├── ancona_data.csv             # 20 cols, has PM2.5, Fahrenheit
│   └── zaragoza_data.csv           # 14 cols, NO PM2.5, Celsius
├── output/                         # All pipeline outputs (gitignored)
│   ├── ml_air_quality.parquet/     # Spark Parquet output (partitioned)
│   ├── ml_air_quality.csv/         # Single CSV (coalesced)
│   ├── mlp_model.pt                # TorchScript-traced model
│   ├── mlp_state.pth               # State dict
│   ├── scaler.pkl                  # StandardScaler
│   ├── feature_columns.pkl         # Feature column names
│   └── metrics.txt                 # Per-target RMSE
├── src/
│   ├── run_pipeline.py             # CLI entry point (spark-submit)
│   ├── config/
│   │   └── session.py              # Spark session & PostgreSQL config
│   ├── sql/
│   │   └── init.sql                # DB schema (raw + ml schemas, tables, indexes)
│   ├── etl/
│   │   ├── spark_etl.py            # Stage 1: Load, unify, clean CSV data
│   │   └── feature_engineering.py  # Stage 2: ML feature engineering (6 transform steps)
│   ├── model/
│   │   ├── train.py                # Stage 3: Data prep, scaling, training orchestration
│   │   └── mlp_model.py            # PyTorch AirQualityMLP + training loop
│   └── api/
│       └── main.py                 # Stage 4: FastAPI backend (/health, /predict, /data/summary)
├── web/                            # Stage 5: Vite + React frontend
│   ├── Dockerfile                  # Multi-stage: Node build → nginx serve
│   ├── nginx.conf                  # Reverse proxy /api/ → airquality-api:8000
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx                 # Tab navigation (Dashboard | Predict | Insights)
│       ├── components/
│       │   ├── Dashboard.tsx       # Summary cards, bar chart, radar chart
│       │   ├── PredictionForm.tsx  # Input form + prediction results
│       │   └── ModelInsights.tsx   # Model architecture info page
│       ├── lib/
│       │   ├── air-quality.ts      # EPA AQI classification logic
│       │   └── utils.ts            # cn() class merging utility
│       └── components/ui/          # shadcn-style primitives
├── notebooks/                      # (reserved for Jupyter)
└── uv.lock                         # Python dependency lockfile
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE ORCHESTRATION                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│  spark-master  │  spark-worker-1  │  spark-worker-2  │  postgres  │  pgadmin     │
│  (Spark Master)│  (2 cores / 2g)  │  (2 cores / 2g)  │ (PG 16)    │  (Admin UI)  │
│                                                                                  │
│  spark-submit ─── runs PySpark ETL + Feature Engineering                         │
│  api (FastAPI) ─ CPU-only, serves MLP predictions                                │
│  web (Vite+Nginx) ─ React/Tailwind dashboard                                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 0: Database Schema

**`src/sql/init.sql`** runs automatically when PostgreSQL starts.

**Schema `raw`** — table `raw.air_quality` (21 columns):
- Timestamp, coordinates, station metadata
- Weather sensors: wind_u/v, dewpoint, soil_temp, precipitation, vegetation, temp, humidity
- Pollutants: PM10, PM2.5, NO2, O3
- Code, ID, city

**Schema `ml`** — table `ml.air_quality_ready` (47 columns):
- All raw columns + 26 engineered features + 3 target variables
- Indexed on `(date)`, `(station_name)`, `(city)`

### Stage 1: ETL — Load, Unify, Clean

**`src/etl/spark_etl.py` → `load_and_unify()`**

Reads 3 city CSVs and produces a single unified DataFrame:

| City | Path | Has PM2.5? | Has code/id? | Temperature |
|------|------|------------|--------------|-------------|
| athens | `athens_data.csv` | Yes | Yes | Celsius |
| ancona | `ancona_data.csv` | Yes | Yes | Fahrenheit |
| zaragoza | `zaragoza_data.csv` | No | No | Celsius |

**Processing steps in order:**
1. **Rename columns** — Maps city-specific column names (e.g., `Date`, `PM10`, `Temp`) to canonical snake_case names via `COLUMN_MAP`
2. **Add missing columns** — Zaragoza gets `pm2_5 = NULL` and `code`/`id` as NULL; all rows get `city` label
3. **Union** — `unionByName(allowMissingColumns=True)` merges all 3 DataFrames
4. **Fahrenheit → Celsius** — Ancona temp columns converted: `(F - 32) × 5/9`
5. **PM2.5 imputation** — Learns PM2.5/PM10 ratio from Athens+Ancona data, imputes Zaragoza's null PM2.5 as `PM10 × ratio`
6. **Timestamp parsing** — String dates cast to Spark timestamps
7. **Null filtering** — Removes rows where ALL 4 pollutants (PM10, PM2.5, NO2, O3) are null
8. **Median imputation** — Remaining nulls in numeric columns filled with column median via `percentile_approx`

**Output:** `raw.air_quality` PostgreSQL table

### Stage 2: Feature Engineering

**`src/etl/feature_engineering.py` → `build_ml_dataset()`**

Reads from PostgreSQL `raw.air_quality` and applies 6 sequential transform steps. Full details in the [Feature Engineering Deep Dive](#feature-engineering-deep-dive) section.

| Step | Function | Features Added |
|------|----------|----------------|
| 1. Temporal | `add_temporal_features()` | year, month, day, hour, day_of_week, is_weekend, season |
| 2. Weather-derived | `add_weather_features()` | wind_speed, wind_direction, temp_dewpoint_spread, temp_soil_diff |
| 3. Pollutant ratios | `add_pollutant_ratios()` | pm10_pm25_ratio, no2_o3_balance |
| 4. Rolling 24h | `add_rolling_features()` | pm10_roll_24h_mean, pm25_roll_24h_mean, no2_roll_24h_mean, o3_roll_24h_mean, o3_roll_24h_max |
| 5. Lag features | `add_lag_features()` | pm10_lag{1,2,3}, pm25_lag{1,2,3}, no2_lag{1,2,3}, o3_lag{1,2,3} |
| 6. Targets | `add_targets()` | pm10_next_24h_mean, pm25_next_24h_mean, o3_next_24h_max |

**Outputs:**
- PostgreSQL `ml.air_quality_ready`
- Parquet → `output/ml_air_quality.parquet/`
- CSV → `output/ml_air_quality.csv/`

### Stage 3: Model Training — PyTorch MLP

**`src/model/train.py` + `src/model/mlp_model.py`**

1. **Load** — Reads Parquet/CSV from `output/`
2. **Prepare** — Drops rows with null targets, one-hot encodes `city` and `season`, splits 80/20 train/validation
3. **Scale** — `StandardScaler` (zero mean, unit variance)
4. **Train** — PyTorch `AirQualityMLP` multi-output regression (all 3 targets simultaneously)

| Hyperparameter | Value |
|----------------|-------|
| Optimizer | Adam (lr=1e-3) |
| Scheduler | ReduceLROnPlateau (factor=0.5, patience=5) |
| Loss | MSELoss |
| Batch size | 64 |
| Max epochs | 200 |
| Early stopping | Patience=10 |

**Outputs:**
- `mlp_model.pt` — TorchScript-traced model
- `mlp_state.pth` — PyTorch state_dict
- `scaler.pkl` — StandardScaler
- `feature_columns.pkl` — Feature column names list
- `metrics.txt` — Per-target RMSE (PM10, PM2.5, O3)

### Stage 4: API Service — FastAPI

**`src/api/main.py`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Returns `{"status": "ok"}` |
| `/data/summary` | GET | Per-city aggregates (avg PM10/PM2.5/NO2/O3, count) |
| `/predict` | POST | Accepts readings → builds 48-feature vector → scales → infers → returns 3 predictions |

**API MLP Architecture:** Linear(48→512) → ReLU → Linear(512→256) → ReLU → Linear(256→128) → ReLU → Linear(128→64) → ReLU → Linear(64→3)

The API reconstructs all 48 features from the 19 input fields — temporal, weather-derived, ratios, rolling, and lag features are computed on-the-fly. Rolling and lag features use current values as approximations since the API has no access to historical data.

### Stage 5: Web Dashboard — React

**`web/`** — Vite + React 18 + TypeScript + Tailwind CSS + Recharts

| Tab | Component | Function |
|-----|-----------|----------|
| Dashboard | `Dashboard.tsx` | AQI summary cards, bar chart (pollutants × city), radar chart (city profiles) |
| Predict | `PredictionForm.tsx` | Sensor input form → POST `/predict` → displays results with AQI badges |
| Insights | `ModelInsights.tsx` | Static model architecture, feature categories, API reference |

Served via Nginx (multi-stage Docker build), reverse-proxying `/api/` to FastAPI.

---

## Feature Engineering Deep Dive

This section explains every feature in the ML-ready dataset, what it represents, and why it matters.

### Input Features Explained

These are the raw sensor readings collected at air quality monitoring stations:

| Column | Type | Description | Unit |
|--------|------|-------------|------|
| `date` | Timestamp | Measurement timestamp | — |
| `latitude` | Float | Station latitude (degrees) | ° |
| `longitude` | Float | Station longitude (degrees) | ° |
| `station_name` | String | Station identifier | — |
| `wind_speed_u` | Float | East-west wind component | m/s |
| `wind_speed_v` | Float | North-south wind component | m/s |
| `dewpoint_temp` | Float | Dewpoint temperature | °C |
| `soil_temp` | Float | Soil temperature | °C |
| `total_percipitation` | Float | Total precipitation | mm |
| `vegetation_high` | Float | High vegetation index | — |
| `vegetation_low` | Float | Low vegetation index | — |
| `temp` | Float | Air temperature | °C |
| `relative_humidity` | Float | Relative humidity | % |
| `pm10` | Float | PM10 concentration (coarse particles) | µg/m³ |
| `pm2_5` | Float | PM2.5 concentration (fine particles) | µg/m³ |
| `no2` | Float | Nitrogen dioxide | ppb |
| `o3` | Float | Ozone | ppb |
| `code` | String | Station code | — |
| `id` | Integer | Station ID | — |
| `city` | String | City label | — |

### 1. Temporal Features

**`add_temporal_features()`** — Extracts time-based patterns from the date column.

| Feature | Description | Purpose |
|---------|-------------|---------|
| `year` | Calendar year (e.g., 2020) | Captures yearly trends, policy changes |
| `month` | Month 1–12 | Seasonal pollution patterns |
| `day` | Day of month 1–31 | Within-month variation |
| `hour` | Hour 0–23 | Diurnal cycles (rush hour, night cooling) |
| `day_of_week` | 1=Sunday, 7=Saturday | Weekly human activity patterns |
| `is_weekend` | Binary 0/1 | Reduced traffic/industry on weekends |
| `season` | Categorical (winter/spring/summer/fall) | Large-scale seasonal meteorological patterns |

These are crucial because air pollution exhibits strong temporal patterns: PM2.5 peaks during winter heating, O3 peaks during summer afternoons, and NO2 spikes during weekday rush hours.

### 2. Weather-Derived Features

**`add_weather_features()`** — Combines raw meteorological readings into more informative quantities.

| Feature | Formula | Description |
|---------|---------|-------------|
| `wind_speed` | `√(U² + V²)` | Wind speed magnitude from vector components |
| `wind_direction` | `atan2(V, U) × 180/π` | Wind direction in degrees (0=East, 90=North) |
| `temp_dewpoint_spread` | `temp - dewpoint_temp` | Temperature-dewpoint difference; proxy for relative humidity |
| `temp_soil_diff` | `temp - soil_temp` | Air-soil temperature gradient; affects vertical mixing |

**Why:** Wind speed and direction determine pollutant dispersion (high wind = dilution). Temperature-dewpoint spread indicates atmospheric stability — a small spread means saturated air which traps pollutants near the surface.

### 3. Pollutant Ratios

**`add_pollutant_ratios()`** — Ratios between pollutants that reveal emission sources and chemistry.

| Feature | Description | Interpretation |
|---------|-------------|----------------|
| `pm10_pm25_ratio` | PM10 ÷ PM2.5 | Ratio > 2.5 suggests coarse dust (construction, wind); ratio < 2 suggests combustion (traffic, industry) |
| `no2_o3_balance` | NO₂ ÷ O₃ | NO₂ and O₃ are anti-correlated in photochemistry; high ratio = fresh emissions, low ratio = aged air mass |

**Why:** These ratios encode source information. A low PM10/PM2.5 ratio indicates fine-particle pollution from combustion. The NO₂/O₃ balance captures atmospheric chemistry — NO₂ titrates O₃, so their ratio indicates air mass age.

### 4. Rolling 24-Hour Features

**`add_rolling_features()`** — Windowed aggregates over the past 24 consecutive readings (rows).

Computed with `Window.partitionBy("station_name").orderBy("date").rowsBetween(-23, 0)`:

| Feature | Description |
|---------|-------------|
| `pm10_roll_24h_mean` | 24-hour rolling mean of PM10 |
| `pm25_roll_24h_mean` | 24-hour rolling mean of PM2.5 |
| `no2_roll_24h_mean` | 24-hour rolling mean of NO₂ |
| `o3_roll_24h_mean` | 24-hour rolling mean of O₃ |
| `o3_roll_24h_max` | 24-hour rolling maximum of O₃ |

**Why:** Air quality standards (EPA, EU) define compliance using 24-hour averages. These features capture the recent pollution context — a current PM10 reading of 50 µg/m³ means very different things if yesterday's average was 20 vs 80. O₃ max is important because ozone's health effects correlate with peak exposures.

### 5. Lag Features (t-1, t-2, t-3)

**`add_lag_features()`** — Previous values of each pollutant at 1, 2, and 3 time steps behind.

Computed with `Window.partitionBy("station_name").orderBy("date").lag(pollutant, N)`:

| Feature | Description | Value range |
|---------|-------------|-------------|
| `pm10_lag1` | PM10 one step ago | One hour back |
| `pm10_lag2` | PM10 two steps ago | Two hours back |
| `pm10_lag3` | PM10 three steps ago | Three hours back |
| `pm25_lag{1,2,3}` | PM2.5 at t-1, t-2, t-3 | — |
| `no2_lag{1,2,3}` | NO₂ at t-1, t-2, t-3 | — |
| `o3_lag{1,2,3}` | O₃ at t-1, t-2, t-3 | — |

**12 lag features total** (4 pollutants × 3 lags).

**Why:** Pollution time series are strongly autocorrelated — what happened in the last 3 hours is the single best predictor of what happens next. These lags give the model a short-term memory of recent concentrations.

### 6. Target Variables

**`add_targets()`** — Future-looking window aggregates (what we want to predict).

Computed with `Window.partitionBy("station_name").orderBy("date").rowsBetween(1, 24)`:

| Target | Description | Aggregation |
|--------|-------------|-------------|
| `pm10_next_24h_mean` | Mean PM10 over the next 24 hours | Average of rows 1–24 ahead |
| `pm25_next_24h_mean` | Mean PM2.5 over the next 24 hours | Average of rows 1–24 ahead |
| `o3_next_24h_max` | Maximum O₃ over the next 24 hours | Maximum of rows 1–24 ahead |

**Why:** These are practical forecasting targets — public health advisories use 24-hour mean PM10/PM2.5 and 8-hour or 24-hour max O₃. Predicting these allows actionable 24-hour air quality forecasts.

### 7. Final Feature Vector

The complete ML-ready dataset contains **47 columns**:

| Category | Count | Columns |
|----------|-------|---------|
| Raw identifiers | 4 | date, latitude, longitude, station_name |
| Raw weather | 9 | wind_speed_u, wind_speed_v, dewpoint_temp, soil_temp, total_percipitation, vegetation_high, vegetation_low, temp, relative_humidity |
| Raw pollutants | 4 | pm10, pm2_5, no2, o3 |
| City | 1 | city |
| Temporal | 7 | year, month, day, hour, day_of_week, is_weekend, season |
| Weather-derived | 4 | wind_speed, wind_direction, temp_dewpoint_spread, temp_soil_diff |
| Pollutant ratios | 2 | pm10_pm25_ratio, no2_o3_balance |
| Rolling 24h | 5 | pm10_roll_24h_mean, pm25_roll_24h_mean, no2_roll_24h_mean, o3_roll_24h_mean, o3_roll_24h_max |
| Lag features | 12 | pm10_lag{1,2,3}, pm25_lag{1,2,3}, no2_lag{1,2,3}, o3_lag{1,2,3} |
| **Targets** | **3** | **pm10_next_24h_mean, pm25_next_24h_mean, o3_next_24h_max** |

After one-hot encoding `city` (3) and `season` (4), plus dropping `date` and `station_name`, the training feature vector is **48 numeric features**.

---

## Model Architecture

The `AirQualityMLP` is a 5-layer fully connected neural network for multi-output regression.

### Training Model (`src/model/mlp_model.py`)

```
Input (48) → Linear(48, 256) → BatchNorm1d(256) → ReLU → Dropout(0.3)
           → Linear(256, 128) → BatchNorm1d(128) → ReLU → Dropout(0.2)
           → Linear(128, 64)   → ReLU
           → Linear(64, 32)    → ReLU
           → Linear(32, 3)     → Output (PM10, PM2.5, O₃)
```

- Batch normalization stabilizes training
- Dropout (0.3, 0.2) prevents overfitting
- ~150K trainable parameters

### API Model (`src/api/main.py`)

```
Input (48) → Linear(48, 512) → ReLU
           → Linear(512, 256) → ReLU
           → Linear(256, 128) → ReLU
           → Linear(128, 64)  → ReLU
           → Linear(64, 3)    → Output
```

- Simpler architecture (no BatchNorm/Dropout) for inference efficiency
- ~343K trainable parameters

---

## Outputs

| Artifact | Format | Location | Producer | Consumer |
|----------|--------|----------|----------|----------|
| Raw unified | PostgreSQL table | `raw.air_quality` | ETL (Spark) | Feature Engineering |
| ML-ready | PostgreSQL table | `ml.air_quality_ready` | Feature Engineering (Spark) | Future consumers |
| ML-ready | Parquet | `output/ml_air_quality.parquet/` | Feature Engineering (Spark) | PyTorch training, API |
| ML-ready | CSV | `output/ml_air_quality.csv/` | Feature Engineering (Spark) | Manual inspection |
| TorchScript model | `.pt` | `output/mlp_model.pt` | Training (PyTorch) | Deployment |
| State dict | `.pth` | `output/mlp_state.pth` | Training (PyTorch) | Checkpoint/restore |
| Scaler | `.pkl` | `output/scaler.pkl` | Training (scikit-learn) | API inference |
| Feature columns | `.pkl` | `output/feature_columns.pkl` | Training | API inference |
| Metrics | `.txt` | `output/metrics.txt` | Training | Developers |

---

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

---

## Parallelism Strategy

| Layer | Mechanism | Resources |
|-------|-----------|-----------|
| **Spark** | 1 master + 2 workers, shuffle.partitions=8, AQE enabled | 4 cores / 4GB total executor memory |
| **Window functions** | Partitioned by `station_name` → parallel per-station time-series processing | Spark distributes across executors |
| **PyTorch** | Single-node CPU-only, DataLoader batch_size=64 | No GPU |
| **FastAPI** | Single uvicorn process | Sequential inference |
| **Web** | Client-side React (no SSR) | Browser |

---

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

### 1. Clone and prepare

```bash
git clone <repo-url> && cd parallel-distribute
cp .env.example .env
```

### 2. Start infrastructure

```bash
docker compose up -d spark-master spark-worker-1 spark-worker-2 postgres pgadmin
```

Wait ~10 s for PostgreSQL healthcheck to pass.

### 3. Run ETL + Feature Engineering

```bash
docker compose --profile job run --rm spark-submit /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --driver-memory 2g \
  --executor-memory 2g \
  /workspace/src/run_pipeline.py --steps etl features
```

This will:
- Load, unify, and clean CSV data from `/workspace/dataset/`
- Write unified data to PostgreSQL (`raw.air_quality`)
- Engineer temporal, weather, rolling, and lag features
- Write the ML-ready dataset to PostgreSQL, Parquet, and CSV

### 4. Train ML model

```bash
docker compose --profile job run --rm spark-submit /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --driver-memory 2g \
  --executor-memory 2g \
  /workspace/src/run_pipeline.py --steps etl features train
```

Or run only specific steps:

```bash
docker compose --profile job run --rm spark-submit /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --driver-memory 2g \
  --executor-memory 2g \
  /workspace/src/run_pipeline.py --steps etl
```

### 5. Launch the web dashboard

```bash
docker compose up -d api web
```

Visit **http://localhost:3000** to see the air quality dashboard.

## Pipeline Steps

| Step | Description |
|------|-------------|
| `etl` | Load CSVs → rename → unify → convert temps → impute PM2.5 → clean → write to `raw.air_quality` |
| `features` | Read from PostgreSQL → add 26 engineered features + 3 targets → write to `ml.air_quality_ready` + Parquet + CSV |
| `train` | Load Parquet → one-hot encode → split 80/20 → scale → train PyTorch MLP → save artifacts |

## Interactive Commands

### Launch a PySpark shell

```bash
docker exec -it spark-master pyspark --master spark://spark-master:7077
```

### Shell access

```bash
docker exec -it spark-master /bin/bash
```

### Run SQL queries

```bash
docker exec -it postgres_dist psql -U root -d dist_f1 -c "SELECT * FROM ml.air_quality_ready LIMIT 10;"
```

## Accessing UIs

| Service | URL |
|---------|-----|
| Spark Master | http://localhost:8080 |
| Spark Worker 1 | http://localhost:8081 |
| Spark Worker 2 | http://localhost:8082 |
| Spark Job (active) | http://localhost:4040 |
| pgAdmin | http://localhost:5050 (admin@gmail.com / admin) |
| PostgreSQL | localhost:4321 (root / root168, database: dist_f1) |
| API Docs | http://localhost:8000/docs |
| Web Dashboard | http://localhost:3000 |

## API Reference

### Health Check

```
GET /health
→ {"status": "ok"}
```

### Data Summary

```
GET /data/summary
→ [
    {"city": "athens", "avg_pm10": 28.4, "avg_pm25": 15.2, "avg_no2": 21.7, "avg_o3": 52.3, "count": 15000},
    ...
  ]
```

### Prediction

```
POST /predict
Content-Type: application/json

{
  "city": "athens",
  "season": "spring",
  "temp": 20,
  "relative_humidity": 60,
  "pm10": 25,
  "pm2_5": 12,
  "no2": 20,
  "o3": 50,
  "wind_speed_u": 0,
  "wind_speed_v": 0,
  "dewpoint_temp": 10,
  "soil_temp": 15,
  "total_percipitation": 0,
  "vegetation_high": 1.7,
  "vegetation_low": 1.5,
  "hour": 12,
  "day_of_week": 3,
  "month": 6,
  "latitude": 38.15,
  "longitude": 23.55
}

→ {
    "pm10_prediction": 22.45,
    "pm25_prediction": 12.18,
    "o3_prediction": 48.32
  }
```

The API expands the 19 input fields into **48 internal features** (with one-hot encoding, derived weather, pollutant ratios, rolling means, and lag approximations) before running inference through the MLP.

## Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (deletes DB data and Spark work dirs)
docker compose down -v
```
