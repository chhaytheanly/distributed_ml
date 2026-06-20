#!/usr/bin/env python3
"""
Spark-submit entry point for the Air Quality ML Pipeline.

Usage:
    spark-submit --master spark://spark-master:7077 /workspace/src/run_pipeline.py
    spark-submit --master spark://spark-master:7077 /workspace/src/run_pipeline.py --steps etl features
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.session import get_spark_session
from etl.spark_etl import load_and_unify, write_to_postgres
from etl.feature_engineering import build_ml_dataset, write_ml_dataset


TARGETS = {
    "pm10_next_24h_mean": "pm10",
    "pm25_next_24h_mean": "pm25",
    "o3_next_24h_max": "o3",
}


def run_etl(spark):
    print("=" * 60)
    print("PHASE 1: ETL — Load, unify, and clean CSV data")
    print("=" * 60)
    df = load_and_unify(spark)
    write_to_postgres(df, "raw.air_quality")
    print(f"[ETL] Wrote {df.count():,} rows to raw.air_quality")
    return df


def run_feature_engineering(spark):
    print("\n" + "=" * 60)
    print("PHASE 2: Feature Engineering — Build ML-ready dataset")
    print("=" * 60)
    ml_df = build_ml_dataset(spark)
    write_ml_dataset(ml_df)
    return ml_df


def run_training(spark):
    from model.train import _prepare_data, train_target, save_model
    print("\n" + "=" * 60)
    print("PHASE 3: ML Training — Gradient Boosted Trees")
    print("=" * 60)
    df = _prepare_data(spark)
    row_count = df.count()
    if row_count == 0:
        print("[WARN] No training data available. Skipping training.")
        return
    print(f"[TRAIN] Training data: {row_count:,} rows")

    for target_col, model_key in TARGETS.items():
        model, metrics = train_target(spark, df, target_col)
        save_model(model, model_key, metrics)


def main():
    parser = argparse.ArgumentParser(description="Air Quality ML Pipeline")
    parser.add_argument(
        "--steps", nargs="+",
        default=["etl", "features", "train"],
        choices=["etl", "features", "train"],
        help="Pipeline steps to run (default: all)",
    )
    args = parser.parse_args()

    spark = get_spark_session("AirQualityPipeline")

    if "etl" in args.steps:
        run_etl(spark)

    if "features" in args.steps:
        run_feature_engineering(spark)

    if "train" in args.steps:
        run_training(spark)

    spark.stop()
    print("\n✓ Pipeline complete!")


if __name__ == "__main__":
    main()
