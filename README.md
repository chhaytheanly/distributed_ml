# Parallel-Distribute

Formula 1 ML-ready data pipeline built with **Apache Spark 3.5.3** and **PySpark**.  
Reads 13 F1 CSV datasets, transforms them into a single feature-rich ML dataset, and outputs to **Parquet**, **CSV**, and **PostgreSQL 16**.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Compute | Apache Spark 3.5.3 (1 master + 2 workers) |
| Language | Python 3.12, PySpark |
| Database | PostgreSQL 16 |
| Admin UI | pgAdmin 4 |
| Orchestration | Docker Compose |
| Package Manager | uv |

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)
- Git

## Quick Start

### 1. Clone and prepare environment

```bash
git clone <repo-url> && cd parallel-distribute
cp .env.example .env     # tweak values if needed
```

### 2. Start the cluster, database, and admin UI

```bash
docker compose up -d spark-master spark-worker-1 spark-worker-2 postgres pgadmin
```

Wait ~10 s for PostgreSQL healthcheck to pass.

### 3. Run the Spark ETL job

```bash
docker compose --profile job up spark-submit
```

The job will:
- Read all CSV files from `src/data/`
- Build a joined ML-ready feature set
- Write **Parquet** to `output/f1_ml_ready.parquet/`
- Write **CSV** to `output/f1_ml_ready_csv/`
- Write the ML dataset + raw tables to PostgreSQL

## Interactive Commands with `docker exec`

Once the cluster is running, use `docker exec` to run Spark commands **directly inside** a container.

### Launch a PySpark shell

```bash
docker exec -it spark-master pyspark --master spark://spark-master:7077
```

### Submit a custom Spark job

```bash
docker exec -it spark-master spark-submit \
  --master spark://spark-master:7077 \
  /workspace/src/app/ml_ready.py
```

Or using the full binary path:

```bash
docker exec -it spark-master /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  /workspace/src/app/ml_ready.py
```

### Run the pipeline interactively in a Python shell

```bash
docker exec -it spark-master python
```

Then within the Python REPL:

```python
from pyspark.sql import SparkSession
spark = SparkSession.builder \
    .appName("interactive") \
    .master("spark://spark-master:7077") \
    .getOrCreate()
df = spark.read.csv("/workspace/src/data/drivers.csv", header=True, inferSchema=True)
df.show(5)
```

### Shell access to any container

```bash
docker exec -it spark-master /bin/bash
docker exec -it spark-worker-1 /bin/bash
docker exec -it postgres_dist /bin/bash
```

### Run SQL queries against the database

```bash
docker exec -it postgres_dist psql -U root -d dist_f1 -c "SELECT * FROM public.f1_ml_ready LIMIT 10;"
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

## Project Structure

```
├── .env.example              # Environment variable template
├── Dockerfile                # Spark image with Python venv & JDBC driver
├── docker-compose.yml        # 6-service orchestration
├── pyproject.toml            # Python dependencies
├── output/                   # Pipeline output (Parquet + CSV)
├── src/
│   ├── data/                 # 14 F1 CSV datasets
│   └── app/
│       ├── ml_ready.py       # Main entry point (spark-submit)
│       ├── config.py         # Environment-based configuration
│       ├── postgres.py       # JDBC writer to PostgreSQL
│       ├── sql/init.sql      # Creates `raw` schema
│       └── transformations/
│           ├── load.py       # SparkSession factory & CSV reader
│           ├── clean.py      # Data cleaning utilities
│           └── transform.py  # Feature engineering & ML dataset builder
```

## Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (deletes DB data)
docker compose down -v
```
