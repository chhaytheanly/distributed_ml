from __future__ import annotations

import logging
from functools import reduce

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from transformations.clean import add_missing_flags, clean_numeric_columns, parse_lap_time_to_ms

logger = logging.getLogger(__name__)

FINISHED_RACE_STATUS_ID = 1


def build_lap_features(lap_times: DataFrame) -> DataFrame:
    return (
        lap_times.groupBy("raceId", "driverId")
        .agg(
            F.avg("milliseconds").alias("avg_lap_ms"),
            F.min("milliseconds").alias("best_lap_ms"),
            F.max("milliseconds").alias("worst_lap_ms"),
            F.stddev("milliseconds").alias("std_lap_ms"),
            F.count("*").alias("lap_time_count"),
        )
        .fillna({"std_lap_ms": 0.0})
    )


def build_pit_features(pit_stops: DataFrame) -> DataFrame:
    return (
        pit_stops.groupBy("raceId", "driverId")
        .agg(
            F.count("*").alias("pit_stop_count"),
            F.avg("milliseconds").alias("avg_pit_stop_ms"),
            F.sum("milliseconds").alias("total_pit_stop_ms"),
        )
        .fillna({"pit_stop_count": 0, "avg_pit_stop_ms": 0.0, "total_pit_stop_ms": 0.0})
    )


def build_qualifying_features(qualifying: DataFrame) -> DataFrame:
    return (
        qualifying.select(
            "raceId",
            "driverId",
            F.col("position").alias("qualifying_position"),
            parse_lap_time_to_ms("q1").alias("q1_ms"),
            parse_lap_time_to_ms("q2").alias("q2_ms"),
            parse_lap_time_to_ms("q3").alias("q3_ms"),
        )
        .withColumn("best_qualifying_ms", F.least(F.coalesce("q1_ms", F.lit(0)), F.coalesce("q2_ms", F.lit(0)), F.coalesce("q3_ms", F.lit(0))))
    )


def build_ml_dataset(tables: dict[str, DataFrame]) -> DataFrame:
    required = {"results", "races", "circuits", "drivers", "constructors", "status", "driver_standings", "constructor_standings", "qualifying", "lap_times", "pit_stops"}
    missing = required - set(tables)
    if missing:
        raise KeyError(f"Missing tables in build_ml_dataset: {missing}")

    results = tables["results"].select(
        "resultId",
        "raceId",
        "driverId",
        "constructorId",
        F.col("number").alias("car_number"),
        "grid",
        F.col("positionOrder").alias("finish_position"),
        F.col("points").alias("race_points"),
        "laps",
        F.col("milliseconds").alias("race_time_ms"),
        "fastestLap",
        F.col("rank").alias("fastest_lap_rank"),
        parse_lap_time_to_ms("fastestLapTime").alias("fastest_lap_ms"),
        F.col("fastestLapSpeed").cast("double").alias("fastest_lap_speed"),
        "statusId",
    )

    races = tables["races"].select(
        "raceId",
        "year",
        "round",
        "circuitId",
        F.col("name").alias("race_name"),
        F.to_date("date").alias("race_date"),
    )

    circuits = tables["circuits"].select(
        "circuitId",
        F.col("name").alias("circuit_name"),
        "location",
        F.col("country").alias("circuit_country"),
        F.col("lat").cast("double").alias("circuit_lat"),
        F.col("lng").cast("double").alias("circuit_lng"),
        F.col("alt").cast("double").alias("circuit_altitude"),
    )

    drivers = tables["drivers"].select(
        "driverId",
        "driverRef",
        F.concat_ws(" ", "forename", "surname").alias("driver_name"),
        F.to_date("dob").alias("driver_dob"),
        F.col("nationality").alias("driver_nationality"),
    )

    constructors = tables["constructors"].select(
        "constructorId",
        "constructorRef",
        F.col("name").alias("constructor_name"),
        F.col("nationality").alias("constructor_nationality"),
    )

    status = tables["status"].select("statusId", F.col("status").alias("finish_status"))
    driver_standings = tables["driver_standings"].select(
        "raceId",
        "driverId",
        F.col("points").alias("driver_season_points_after_race"),
        F.col("position").alias("driver_standing_after_race"),
        F.col("wins").alias("driver_wins_after_race"),
    )
    constructor_standings = tables["constructor_standings"].select(
        "raceId",
        "constructorId",
        F.col("points").alias("constructor_season_points_after_race"),
        F.col("position").alias("constructor_standing_after_race"),
        F.col("wins").alias("constructor_wins_after_race"),
    )

    joins = [
        (races, ["raceId"], "left"),
        (circuits, ["circuitId"], "left"),
        (drivers, ["driverId"], "left"),
        (constructors, ["constructorId"], "left"),
        (status, ["statusId"], "left"),
        (driver_standings, ["raceId", "driverId"], "left"),
        (constructor_standings, ["raceId", "constructorId"], "left"),
        (build_qualifying_features(tables["qualifying"]), ["raceId", "driverId"], "left"),
        (build_lap_features(tables["lap_times"]), ["raceId", "driverId"], "left"),
        (build_pit_features(tables["pit_stops"]), ["raceId", "driverId"], "left"),
    ]

    merged = reduce(lambda df, join_spec: df.join(*join_spec), joins, results)

    merged = merged.select(
        "*",
        F.floor(F.months_between("race_date", "driver_dob") / 12).alias("driver_age_years"),
    )
    merged = merged.withColumn("grid_missing", F.when(F.col("grid").isNull() | (F.col("grid") == 0), 1).otherwise(0))
    merged = merged.withColumn("started_from_pit_lane", F.when(F.col("grid") == 0, 1).otherwise(0))
    merged = merged.withColumn("is_podium", F.when(F.col("finish_position") <= 3, 1).otherwise(0))
    merged = merged.withColumn("is_winner", F.when(F.col("finish_position") == 1, 1).otherwise(0))
    merged = merged.withColumn("finished_race", F.when(F.col("statusId") == FINISHED_RACE_STATUS_ID, 1).otherwise(0))
    merged = merged.drop("driver_dob")

    numeric_fill = {
        "race_time_ms": -1,
        "fastestLap": -1,
        "fastest_lap_rank": -1,
        "fastest_lap_ms": -1,
        "fastest_lap_speed": -1.0,
        "qualifying_position": -1,
        "q1_ms": -1,
        "q2_ms": -1,
        "q3_ms": -1,
        "best_qualifying_ms": -1,
        "avg_lap_ms": -1.0,
        "best_lap_ms": -1,
        "worst_lap_ms": -1,
        "std_lap_ms": 0.0,
        "lap_time_count": 0,
        "pit_stop_count": 0,
        "avg_pit_stop_ms": 0.0,
        "total_pit_stop_ms": 0.0,
        "driver_season_points_after_race": 0.0,
        "driver_standing_after_race": -1,
        "driver_wins_after_race": 0,
        "constructor_season_points_after_race": 0.0,
        "constructor_standing_after_race": -1,
        "constructor_wins_after_race": 0,
        "driver_age_years": -1,
    }

    merged = add_missing_flags(merged, list(numeric_fill.keys()))
    merged = merged.fillna(numeric_fill)
    merged = clean_numeric_columns(
        merged,
        [
            "grid",
            "finish_position",
            "race_points",
            "laps",
            "circuit_lat",
            "circuit_lng",
            "circuit_altitude",
        ],
    )

    return merged.dropDuplicates(["resultId"])
