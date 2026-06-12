from __future__ import annotations

import os


DATA_DIR: str = os.getenv("DATA_DIR", "/workspace/src/data")
OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "/workspace/output")
OUTPUT_CSV_PARTITIONS: int = int(os.getenv("OUTPUT_CSV_PARTITIONS", "1"))
SPARK_MASTER_URL: str = os.getenv("SPARK_MASTER_URL", "local[*]")
SPARK_SHUFFLE_PARTITIONS: int = int(os.getenv("SPARK_SHUFFLE_PARTITIONS", "8"))

POSTGRES_URL: str = os.getenv("POSTGRES_URL", "jdbc:postgresql://postgres:5432/dist_f1")
POSTGRES_USER: str = os.getenv("POSTGRES_USER", "root")
POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "root168")
