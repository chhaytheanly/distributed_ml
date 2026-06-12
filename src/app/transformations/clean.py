from __future__ import annotations

import logging

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

logger = logging.getLogger(__name__)


def parse_lap_time_to_ms(col_name: str) -> F.Column:
    col = F.col(col_name)
    parts = F.split(col, ":")
    has_parts = F.size(parts) == 2
    minutes = F.when(has_parts, parts.getItem(0).cast("double")).otherwise(F.lit(0.0))
    seconds = F.when(has_parts, parts.getItem(1).cast("double")).otherwise(col.cast("double"))
    return ((minutes * F.lit(60.0) + seconds) * F.lit(1000.0)).cast("int")


def clean_numeric_columns(df: DataFrame, numeric_columns: list[str]) -> DataFrame:
    exprs = [F.col(c).cast("double").alias(c) if c in df.columns else F.col(c) for c in numeric_columns]
    others = [F.col(c) for c in df.columns if c not in numeric_columns]
    return df.select(*others, *exprs)


def add_missing_flags(df: DataFrame, columns: list[str]) -> DataFrame:
    flags = [F.col(c).isNull().cast("int").alias(f"{c}_missing") for c in columns if c in df.columns]
    if not flags:
        return df
    return df.select("*", *flags)
