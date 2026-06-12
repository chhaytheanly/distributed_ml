from __future__ import annotations

import logging

from pyspark.sql import DataFrame

from config import POSTGRES_PASSWORD, POSTGRES_URL, POSTGRES_USER

logger = logging.getLogger(__name__)


def write_postgres(df: DataFrame, table_name: str, mode: str = "overwrite") -> None:
    try:
        (
            df.write.format("jdbc")
            .option("url", POSTGRES_URL)
            .option("dbtable", table_name)
            .option("user", POSTGRES_USER)
            .option("password", POSTGRES_PASSWORD)
            .option("driver", "org.postgresql.Driver")
            .mode(mode)
            .save()
        )
        logger.info("Wrote %d rows to PostgreSQL table %s", df.count(), table_name)
    except Exception:
        logger.exception("Failed to write to PostgreSQL table %s", table_name)
        raise
