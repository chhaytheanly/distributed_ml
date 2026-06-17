import os
from pyspark.sql import SparkSession


def get_spark_session(app_name: str = "AirQualityML") -> SparkSession:
    master_url = os.getenv("SPARK_MASTER_URL", "spark://spark-master:7077")

    return (
        SparkSession.builder
        .appName(app_name)
        .master(master_url)
        .config("spark.sql.shuffle.partitions", os.getenv("SPARK_SHUFFLE_PARTITIONS", "8"))
        .config("spark.jars", "/opt/spark/jars/postgresql-42.7.2.jar")
        .config("spark.sql.adaptive.enabled", "true")
        .getOrCreate()
    )


def get_pg_properties() -> dict:
    return {
        "url": os.getenv("POSTGRES_URL", "jdbc:postgresql://postgres:5432/dist_f1"),
        "user": os.getenv("POSTGRES_USER", "root"),
        "password": os.getenv("POSTGRES_PASSWORD", "root168"),
        "driver": "org.postgresql.Driver",
    }
