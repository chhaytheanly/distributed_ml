# Air Quality ML Pipeline

End-to-end air quality data pipeline — ETL, feature engineering, and ML training — built with **Apache Spark 3.5.3** and **PySpark**. Ingests CSV data from 3 European cities (Athens, Ancona, Zaragoza), unifies and cleans it, engineers a rich ML-ready feature set, and trains Gradient Boosted Tree models for pollutant forecasting.

Outputs to **Parquet**, **CSV**, and **PostgreSQL 16**.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Compute | Apache Spark 3.5.3 (1 master + 2 workers) |
| Language | Python 3.12, PySpark |
| Database | PostgreSQL 16 |
| Admin UI | pgAdmin 4 |
| API | FastAPI |
| Frontend | Vite + Tailwind CSS |
| Orchestration | Docker Compose |

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

### 1. Clone and prepare

```bash
git clone <repo-url> && cd parallel-distribute
cp .env.example .env     # tweak values if needed
```

### 2. Start the cluster, database, and services

```bash
docker compose up -d spark-master spark-worker-1 spark-worker-2 postgres pgadmin
```

Wait ~10 s for PostgreSQL healthcheck to pass.

### 3. Run the full pipeline (ETL + feature engineering)

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
- Write the ML-ready dataset to:
  - PostgreSQL (`ml.air_quality_ready`)
  - Parquet → `output/ml_air_quality.parquet/`
  - CSV → `output/ml_air_quality.csv/`

### 4. (Optional) Train ML models

```bash
docker compose --profile job run --rm spark-submit /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --driver-memory 2g \
  --executor-memory 2g \
  /workspace/src/run_pipeline.py --steps etl features train
```

Or run only specific steps (e.g. just ETL):

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

Visit http://localhost:3000 to see the air quality dashboard.

## Interactive Commands

### Launch a PySpark shell

```bash
docker exec -it spark-master pyspark --master spark://spark-master:7077
```

### Shell access

```bash
docker exec -it spark-master /bin/bash
docker exec -it spark-worker-1 /bin/bash
docker exec -it postgres_dist /bin/bash
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

## Project Structure

```
├── .env.example              # Environment variable template
├── Dockerfile                # Spark image with Python venv & JDBC driver
├── docker-compose.yml        # Multi-service orchestration
├── pyproject.toml            # Python dependencies
├── dataset/                  # 3 city CSV datasets
│   ├── athens_data.csv
│   ├── ancona_data.csv
│   └── zaragoza_data.csv
├── output/                   # Pipeline output (Parquet + CSV)
├── src/
│   ├── run_pipeline.py       # Main entry point (spark-submit)
│   ├── config/
│   │   └── session.py        # Spark session & PostgreSQL config
│   ├── etl/
│   │   ├── spark_etl.py      # Load, unify, clean CSV data
│   │   └── feature_engineering.py  # ML feature engineering
│   ├── model/
│   │   └── train.py          # GBT model training
│   ├── api/
│   │   └── main.py           # FastAPI backend
│   └── sql/
│       └── init.sql          # DB schema (raw + ml schemas)
├── web/                      # Vite + Tailwind frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── src/
│   └── public/
```

## Pipeline Steps

| Step | Description |
|------|-------------|
| `etl` | Load CSVs → rename columns → unify → convert temps → impute PM2.5 → clean → write to `raw.air_quality` |
| `features` | Read from PostgreSQL → add temporal/weather/pollutant-ratio features → rolling 24h windows → lag features → target variables → write to `ml.air_quality_ready` + Parquet + CSV |
| `train` | Prepare data → train GBT regressors for PM10, PM2.5, O3 → save models |

## Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (deletes DB data and Spark work dirs)
docker compose down -v
```
