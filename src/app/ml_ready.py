from __future__ import annotations

import logging
import sys

from pyspark.sql import DataFrame

from config import OUTPUT_CSV_PARTITIONS, OUTPUT_DIR
from postgres import write_postgres
from transformations.load import read_csv, spark_session
from transformations.transform import build_ml_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def main() -> None:
    spark = spark_session()
    table_names: list[str] = [
        "circuits",
        "constructors",
        "constructor_standings",
        "drivers",
        "driver_standings",
        "lap_times",
        "pit_stops",
        "qualifying",
        "races",
        "results",
        "status",
    ]

    try:
        tables: dict[str, DataFrame] = {name: read_csv(spark, name) for name in table_names}
        logger.info("Loaded %d tables from CSV", len(tables))

        ml_dataset = build_ml_dataset(tables)
        ml_dataset.cache()

        row_count = ml_dataset.count()
        col_count = len(ml_dataset.columns)
        logger.info("ML dataset: %d rows, %d columns", row_count, col_count)

        ml_dataset.write.mode("overwrite").parquet(f"{OUTPUT_DIR}/f1_ml_ready.parquet")
        logger.info("Wrote parquet to %s/f1_ml_ready.parquet", OUTPUT_DIR)

        ml_dataset.coalesce(OUTPUT_CSV_PARTITIONS).write.mode("overwrite").option("header", True).csv(
            f"{OUTPUT_DIR}/f1_ml_ready_csv"
        )
        logger.info("Wrote CSV to %s/f1_ml_ready_csv (%d partition(s))", OUTPUT_DIR, OUTPUT_CSV_PARTITIONS)

        write_postgres(ml_dataset, "public.f1_ml_ready")

        for name, df in tables.items():
            write_postgres(df, f"raw.{name}")

    except Exception:
        logger.exception("Pipeline failed")
        sys.exit(1)
    finally:
        spark.stop()
        logger.info("Spark session stopped")


if __name__ == "__main__":
    main()
