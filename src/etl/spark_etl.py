import os
import sys
from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    col, lit, when, to_timestamp, coalesce, avg as _avg,
    expr
)
from pyspark.sql.types import DoubleType, IntegerType, StringType

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.session import get_spark_session, get_pg_properties


# ── Canonical column mapping ────────────────────────────────────────────────
CANONICAL_COLUMNS = [
    "date", "latitude", "longitude", "station_name",
    "wind_speed_u", "wind_speed_v", "dewpoint_temp", "soil_temp",
    "total_percipitation", "vegetation_high", "vegetation_low",
    "temp", "relative_humidity", "pm10", "pm2_5", "no2", "o3",
    "code", "id", "city",
]

COLUMN_MAP = {
    "Date": "date",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "Wind-Speed (U)": "wind_speed_u",
    "Wind-Speed (V)": "wind_speed_v",
    "Dewpoint Temp": "dewpoint_temp",
    "Soil Temp": "soil_temp",
    "Total Percipitation": "total_percipitation",
    "Vegitation (High)": "vegetation_high",
    "Vegitation (Low)": "vegetation_low",
    "Relative Humidity": "relative_humidity",
    "Temp": "temp",
    "PM10": "pm10",
    "PM2.5": "pm2_5",
    "NO2": "no2",
    "O3": "o3",
}

CITIES_CONFIG = [
    {
        "city": "athens",
        "path": "/workspace/dataset/athens_data.csv",
        "has_pm25": True,
        "has_code_id": True,
        "temp_unit": "celsius",
    },
    {
        "city": "ancona",
        "path": "/workspace/dataset/ancona_data.csv",
        "has_pm25": True,
        "has_code_id": True,
        "temp_unit": "fahrenheit",
    },
    {
        "city": "zaragoza",
        "path": "/workspace/dataset/zaragoza_data.csv",
        "has_pm25": False,
        "has_code_id": False,
        "temp_unit": "celsius",
    },
]


# ── Helpers ─────────────────────────────────────────────────────────────────

def _rename_cols(df: DataFrame) -> DataFrame:
    for old, new in COLUMN_MAP.items():
        df = df.withColumnRenamed(old, new)
    return df


def _add_missing_cols(df: DataFrame, cfg: dict) -> DataFrame:
    if not cfg["has_pm25"]:
        df = df.withColumn("pm2_5", lit(None).cast(DoubleType()))
    if not cfg["has_code_id"]:
        df = df.withColumn("code", lit(None).cast(StringType()))
        df = df.withColumn("id", lit(None).cast(IntegerType()))
    df = df.withColumn("city", lit(cfg["city"]))
    return df


def _ensure_col_order(df: DataFrame) -> DataFrame:
    existing = [c for c in CANONICAL_COLUMNS if c in df.columns]
    return df.select(*existing)


def _fahrenheit_to_celsius(df: DataFrame) -> DataFrame:
    temp_cols = ["dewpoint_temp", "soil_temp", "temp"]
    for c_name in temp_cols:
        df = df.withColumn(
            c_name,
            when(col("city") == "ancona", (col(c_name) - 32.0) * 5.0 / 9.0)
            .otherwise(col(c_name))
        )
    return df


def _impute_pm25(df: DataFrame) -> DataFrame:
    ratio_df = (
        df.filter(col("city").isin("athens", "ancona"))
        .filter(col("pm10").isNotNull() & col("pm2_5").isNotNull() & (col("pm10") > 0))
        .agg(_avg(col("pm2_5") / col("pm10")).alias("ratio"))
    )
    row = ratio_df.collect()[0]
    ratio = row["ratio"] if row["ratio"] is not None else 0.5

    df = df.withColumn(
        "pm2_5",
        when(col("pm2_5").isNull() & col("pm10").isNotNull(),
             col("pm10") * lit(ratio))
        .otherwise(col("pm2_5"))
    )
    return df


def _clean(df: DataFrame) -> DataFrame:
    df = df.withColumn("date", to_timestamp("date"))

    pollutant_cols = ["pm10", "pm2_5", "no2", "o3"]
    all_null = lit(True)
    for c in pollutant_cols:
        all_null = all_null & col(c).isNull()
    df = df.filter(~all_null)

    impute_cols = pollutant_cols + [
        "wind_speed_u", "wind_speed_v", "dewpoint_temp", "soil_temp",
        "total_percipitation", "temp", "relative_humidity",
    ]
    agg_exprs = [expr(f"percentile_approx({c}, 0.5)").alias(c) for c in impute_cols]
    medians = df.select(*agg_exprs).collect()[0].asDict()

    for c in impute_cols:
        if medians[c] is not None:
            df = df.withColumn(c, coalesce(col(c), lit(medians[c])))

    return df


# ── Main ETL ────────────────────────────────────────────────────────────────

def load_and_unify(spark, data_dir: str = "/workspace/dataset") -> DataFrame:
    dfs = []
    for cfg in CITIES_CONFIG:
        path = cfg["path"]
        print(f"[ETL] Loading {cfg['city']} from {path}")
        df = spark.read.csv(path, header=True, inferSchema=True)
        df = _rename_cols(df)
        df = _add_missing_cols(df, cfg)
        dfs.append(df)

    unified = dfs[0]
    for df in dfs[1:]:
        unified = unified.unionByName(df, allowMissingColumns=True)

    unified = _ensure_col_order(unified)
    unified = _fahrenheit_to_celsius(unified)
    unified = _impute_pm25(unified)
    unified = _clean(unified)

    print(f"[ETL] Unified dataset: {unified.count():,} rows, "
          f"{len(unified.columns)} columns")
    return unified


def write_to_postgres(df: DataFrame, table: str, mode: str = "overwrite"):
    props = get_pg_properties()
    print(f"[ETL] Writing to PostgreSQL: {table}")
    (
        df.write
        .mode(mode)
        .jdbc(props["url"], table, properties=props)
    )
    print(f"[ETL] Done writing {table}")


if __name__ == "__main__":
    spark = get_spark_session("AirQualityETL")
    df = load_and_unify(spark)
    write_to_postgres(df, "raw.air_quality")
    spark.stop()
