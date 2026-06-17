import os
import sys
from pyspark.sql import Window
from pyspark.sql.functions import (
    col, year, month, dayofmonth, hour, dayofweek,
    when, sqrt, atan2, avg, max,
    lag, lit, coalesce, expr
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.session import get_spark_session, get_pg_properties


def add_temporal_features(df):
    return (
        df
        .withColumn("year", year("date"))
        .withColumn("month", month("date"))
        .withColumn("day", dayofmonth("date"))
        .withColumn("hour", hour("date"))
        .withColumn("day_of_week", dayofweek("date"))
        .withColumn("is_weekend",
                    when(col("day_of_week").isin(1, 7), lit(1)).otherwise(lit(0)))
        .withColumn("season",
                    when(col("month").isin(12, 1, 2), lit("winter"))
                    .when(col("month").isin(3, 4, 5), lit("spring"))
                    .when(col("month").isin(6, 7, 8), lit("summer"))
                    .otherwise(lit("fall")))
    )


def add_weather_features(df):
    return (
        df
        .withColumn("wind_speed",
                    sqrt(col("wind_speed_u") ** 2 + col("wind_speed_v") ** 2))
        .withColumn("wind_direction",
                    atan2(col("wind_speed_v"), col("wind_speed_u")) * lit(180.0 / 3.141592653589793))
        .withColumn("temp_dewpoint_spread",
                    col("temp") - col("dewpoint_temp"))
        .withColumn("temp_soil_diff",
                    col("temp") - col("soil_temp"))
    )


def add_pollutant_ratios(df):
    return (
        df
        .withColumn("pm10_pm25_ratio",
                    when(col("pm2_5").isNotNull() & (col("pm2_5") > 0),
                         col("pm10") / col("pm2_5"))
                    .otherwise(lit(None)))
        .withColumn("no2_o3_balance",
                    when(col("o3").isNotNull() & (col("o3") > 0),
                         col("no2") / col("o3"))
                    .otherwise(lit(None)))
    )


def add_rolling_features(df):
    window_24h = (
        Window.partitionBy("station_name")
        .orderBy("date")
        .rowsBetween(-23, 0)
    )
    return (
        df
        .withColumn("pm10_roll_24h_mean", avg("pm10").over(window_24h))
        .withColumn("pm25_roll_24h_mean", avg("pm2_5").over(window_24h))
        .withColumn("no2_roll_24h_mean", avg("no2").over(window_24h))
        .withColumn("o3_roll_24h_mean", avg("o3").over(window_24h))
        .withColumn("o3_roll_24h_max", max("o3").over(window_24h))
    )


def add_lag_features(df):
    w = Window.partitionBy("station_name").orderBy("date")
    return (
        df
        .withColumn("pm10_lag1", lag("pm10", 1).over(w))
        .withColumn("pm10_lag2", lag("pm10", 2).over(w))
        .withColumn("pm10_lag3", lag("pm10", 3).over(w))
        .withColumn("pm25_lag1", lag("pm2_5", 1).over(w))
        .withColumn("pm25_lag2", lag("pm2_5", 2).over(w))
        .withColumn("pm25_lag3", lag("pm2_5", 3).over(w))
        .withColumn("no2_lag1", lag("no2", 1).over(w))
        .withColumn("no2_lag2", lag("no2", 2).over(w))
        .withColumn("no2_lag3", lag("no2", 3).over(w))
        .withColumn("o3_lag1", lag("o3", 1).over(w))
        .withColumn("o3_lag2", lag("o3", 2).over(w))
        .withColumn("o3_lag3", lag("o3", 3).over(w))
    )


def add_targets(df):
    window_future = (
        Window.partitionBy("station_name")
        .orderBy("date")
        .rowsBetween(1, 24)
    )
    return (
        df
        .withColumn("pm10_next_24h_mean", avg("pm10").over(window_future))
        .withColumn("pm25_next_24h_mean", avg("pm2_5").over(window_future))
        .withColumn("o3_next_24h_max", max("o3").over(window_future))
    )


ML_FEATURE_COLUMNS = [
    "date", "latitude", "longitude", "station_name", "city",
    "wind_speed_u", "wind_speed_v", "dewpoint_temp", "soil_temp",
    "total_percipitation", "vegetation_high", "vegetation_low",
    "temp", "relative_humidity", "pm10", "pm2_5", "no2", "o3",
    "year", "month", "day", "hour", "day_of_week", "is_weekend", "season",
    "wind_speed", "wind_direction", "temp_dewpoint_spread", "temp_soil_diff",
    "pm10_pm25_ratio", "no2_o3_balance",
    "pm10_roll_24h_mean", "pm25_roll_24h_mean",
    "no2_roll_24h_mean", "o3_roll_24h_mean", "o3_roll_24h_max",
    "pm10_lag1", "pm10_lag2", "pm10_lag3",
    "pm25_lag1", "pm25_lag2", "pm25_lag3",
    "no2_lag1", "no2_lag2", "no2_lag3",
    "o3_lag1", "o3_lag2", "o3_lag3",
    "pm10_next_24h_mean", "pm25_next_24h_mean", "o3_next_24h_max",
]


def build_ml_dataset(spark):
    props = get_pg_properties()
    print("[FE] Reading raw.air_quality from PostgreSQL")

    df = (
        spark.read
        .jdbc(props["url"], "raw.air_quality", properties=props)
        .sort("station_name", "date")
    )

    print(f"[FE] Raw rows: {df.count():,}")

    df = add_temporal_features(df)
    df = add_weather_features(df)
    df = add_pollutant_ratios(df)
    df = add_rolling_features(df)
    df = add_lag_features(df)
    df = add_targets(df)

    existing = [c for c in ML_FEATURE_COLUMNS if c in df.columns]
    df = df.select(*existing)

    print(f"[FE] ML-ready rows: {df.count():,}, columns: {len(df.columns)}")
    return df


def write_ml_dataset(df):
    props = get_pg_properties()
    output_dir = os.environ.get("OUTPUT_DIR", "/workspace/output")

    print(f"[FE] Writing to PostgreSQL: ml.air_quality_ready")
    (
        df.write
        .mode("overwrite")
        .option("batchsize", "10000")
        .jdbc(props["url"], "ml.air_quality_ready", properties=props)
    )
    print(f"[FE] Done writing ml.air_quality_ready")

    print(f"[FE] Writing parquet to {output_dir}/ml_air_quality.parquet")
    (
        df.write
        .mode("overwrite")
        .parquet(f"{output_dir}/ml_air_quality.parquet")
    )
    print(f"[FE] Writing CSV to {output_dir}/ml_air_quality.csv")
    (
        df.coalesce(1).write
        .mode("overwrite")
        .option("header", True)
        .csv(f"{output_dir}/ml_air_quality.csv")
    )
    print(f"[FE] Done writing files to {output_dir}")


if __name__ == "__main__":
    spark = get_spark_session("AirQualityFeatureEngineering")
    ml_df = build_ml_dataset(spark)
    write_ml_dataset(ml_df)
    spark.stop()
