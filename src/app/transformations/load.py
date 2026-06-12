from __future__ import annotations

import logging
import os

from pyspark.sql import DataFrame, SparkSession

from config import DATA_DIR, SPARK_MASTER_URL, SPARK_SHUFFLE_PARTITIONS

logger = logging.getLogger(__name__)


def spark_session() -> SparkSession:
    return (
        SparkSession.builder.appName("f1-ml-cleaning")
        .master(SPARK_MASTER_URL)
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", str(SPARK_SHUFFLE_PARTITIONS))
        .getOrCreate()
    )


def read_csv(spark: SparkSession, name: str) -> DataFrame:
    path = f"{DATA_DIR}/{name}.csv"
    if not os.path.isfile(path):
        raise FileNotFoundError(f"CSV not found: {path}")
    logger.info("Reading %s", path)
    return (
        spark.read.option("header", True)
        .option("inferSchema", True)
        .option("nullValue", r"\N")
        .option("quote", '"')
        .option("escape", '"')
        .csv(path)
    )
