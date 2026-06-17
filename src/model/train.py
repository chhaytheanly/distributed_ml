import os
import sys
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler, StringIndexer
from pyspark.ml.regression import GBTRegressor
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.tuning import CrossValidator, ParamGridBuilder

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.session import get_spark_session, get_pg_properties


EXCLUDED_COLS = {
    "date", "station_name", "city", "season",
    "pm10_next_24h_mean", "pm25_next_24h_mean", "o3_next_24h_max",
}

TARGETS = {
    "pm10_next_24h_mean": {"name": "pm10", "metric": "rmse"},
    "pm25_next_24h_mean": {"name": "pm25", "metric": "rmse"},
    "o3_next_24h_max": {"name": "o3", "metric": "rmse"},
}


def _get_feature_cols(df):
    return [c for c in df.columns if c not in EXCLUDED_COLS]


def _prepare_data(spark):
    props = get_pg_properties()
    print("[TRAIN] Reading ml.air_quality_ready from PostgreSQL")
    df = (
        spark.read
        .jdbc(props["url"], "ml.air_quality_ready", properties=props)
        .dropna(subset=list(TARGETS.keys()))
    )
    print(f"[TRAIN] Rows with targets: {df.count():,}")
    return df


def train_target(spark, df, target_col: str):
    print(f"\n{'='*60}")
    print(f"[TRAIN] Training model for: {target_col}")
    print(f"{'='*60}")

    feature_cols = _get_feature_cols(df)
    numeric_cols = [c for c in feature_cols
                    if c not in ("city", "season") and c in df.columns]

    categorical_cols = []
    for c in ("city", "season"):
        if c in df.columns:
            categorical_cols.append(c)

    stages = []

    indexers = []
    for c in categorical_cols:
        indexer = StringIndexer(inputCol=c, outputCol=f"{c}_idx",
                                handleInvalid="keep")
        stages.append(indexer)
        numeric_cols.append(f"{c}_idx")

    assembler = VectorAssembler(
        inputCols=numeric_cols,
        outputCol="features",
        handleInvalid="keep",
    )
    stages.append(assembler)

    gbt = GBTRegressor(
        featuresCol="features",
        labelCol=target_col,
        maxIter=100,
        maxDepth=6,
        seed=42,
    )
    stages.append(gbt)

    pipeline = Pipeline(stages=stages)

    param_grid = (
        ParamGridBuilder()
        .addGrid(gbt.maxIter, [50, 100])
        .addGrid(gbt.maxDepth, [4, 6])
        .addGrid(gbt.stepSize, [0.05, 0.1])
        .build()
    )

    evaluator = RegressionEvaluator(
        labelCol=target_col,
        predictionCol="prediction",
        metricName="rmse",
    )

    cv = CrossValidator(
        estimator=pipeline,
        estimatorParamMaps=param_grid,
        evaluator=evaluator,
        numFolds=3,
        seed=42,
        parallelism=2,
    )

    print(f"[TRAIN] Features: {len(numeric_cols)}")
    print(f"[TRAIN] Running 3-fold CV with {len(param_grid)} param combos...")

    cv_model = cv.fit(df)
    best_model = cv_model.bestModel

    train_pred = best_model.transform(df)
    rmse = evaluator.evaluate(train_pred)
    r2 = RegressionEvaluator(
        labelCol=target_col, predictionCol="prediction", metricName="r2"
    ).evaluate(train_pred)

    print(f"[TRAIN] {target_col} — RMSE: {rmse:.4f}, R²: {r2:.4f}")
    print(f"[TRAIN] Best params: {best_model.stages[-1].extractParamMap()}")

    return best_model, {"rmse": rmse, "r2": r2}


def save_model(model, target_key: str, metrics: dict):
    output_dir = os.getenv("OUTPUT_DIR", "/workspace/output")
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, f"gbt_{target_key}")
    model.write().overwrite().save(model_path)

    report_path = os.path.join(output_dir, "metrics.txt")
    with open(report_path, "a") as f:
        f.write(f"{target_key}: RMSE={metrics['rmse']:.4f}, R²={metrics['r2']:.4f}\n")

    print(f"[TRAIN] Model saved to {model_path}")
    print(f"[TRAIN] Metrics appended to {report_path}")


if __name__ == "__main__":
    spark = get_spark_session("AirQualityMLTrain")
    df = _prepare_data(spark)

    for target_col in TARGETS:
        model, metrics = train_target(spark, df, target_col)
        save_model(model, TARGETS[target_col]["name"], metrics)

    spark.stop()
    print("\n[TRAIN] All models trained successfully!")
