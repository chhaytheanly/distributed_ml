CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS ml;

-- Raw unified air quality data
CREATE TABLE IF NOT EXISTS raw.air_quality (
    date                TIMESTAMP,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    station_name        VARCHAR(255),
    wind_speed_u        DOUBLE PRECISION,
    wind_speed_v        DOUBLE PRECISION,
    dewpoint_temp       DOUBLE PRECISION,
    soil_temp           DOUBLE PRECISION,
    total_percipitation DOUBLE PRECISION,
    vegetation_high     DOUBLE PRECISION,
    vegetation_low      DOUBLE PRECISION,
    temp                DOUBLE PRECISION,
    relative_humidity   DOUBLE PRECISION,
    pm10                DOUBLE PRECISION,
    pm2_5               DOUBLE PRECISION,
    no2                 DOUBLE PRECISION,
    o3                  DOUBLE PRECISION,
    code                VARCHAR(50),
    id                  INTEGER,
    city                VARCHAR(50)
);

-- ML-ready feature set
CREATE TABLE IF NOT EXISTS ml.air_quality_ready (
    date                TIMESTAMP,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    station_name        VARCHAR(255),
    city                VARCHAR(50),

    -- Raw weather
    wind_speed_u        DOUBLE PRECISION,
    wind_speed_v        DOUBLE PRECISION,
    dewpoint_temp       DOUBLE PRECISION,
    soil_temp           DOUBLE PRECISION,
    total_percipitation DOUBLE PRECISION,
    vegetation_high     DOUBLE PRECISION,
    vegetation_low      DOUBLE PRECISION,
    temp                DOUBLE PRECISION,
    relative_humidity   DOUBLE PRECISION,

    -- Raw pollutants
    pm10                DOUBLE PRECISION,
    pm2_5               DOUBLE PRECISION,
    no2                 DOUBLE PRECISION,
    o3                  DOUBLE PRECISION,

    -- Temporal features
    year                INTEGER,
    month               INTEGER,
    day                 INTEGER,
    hour                INTEGER,
    day_of_week         INTEGER,
    is_weekend          INTEGER,
    season              VARCHAR(10),

    -- Derived weather features
    wind_speed          DOUBLE PRECISION,
    wind_direction      DOUBLE PRECISION,
    temp_dewpoint_spread DOUBLE PRECISION,
    temp_soil_diff      DOUBLE PRECISION,

    -- Pollutant ratios
    pm10_pm25_ratio     DOUBLE PRECISION,
    no2_o3_balance      DOUBLE PRECISION,

    -- Rolling 24h features
    pm10_roll_24h_mean  DOUBLE PRECISION,
    pm25_roll_24h_mean  DOUBLE PRECISION,
    no2_roll_24h_mean   DOUBLE PRECISION,
    o3_roll_24h_mean    DOUBLE PRECISION,
    o3_roll_24h_max     DOUBLE PRECISION,

    -- Lag features (t-1, t-2, t-3)
    pm10_lag1           DOUBLE PRECISION,
    pm10_lag2           DOUBLE PRECISION,
    pm10_lag3           DOUBLE PRECISION,
    pm25_lag1           DOUBLE PRECISION,
    pm25_lag2           DOUBLE PRECISION,
    pm25_lag3           DOUBLE PRECISION,
    no2_lag1            DOUBLE PRECISION,
    no2_lag2            DOUBLE PRECISION,
    no2_lag3            DOUBLE PRECISION,
    o3_lag1             DOUBLE PRECISION,
    o3_lag2             DOUBLE PRECISION,
    o3_lag3             DOUBLE PRECISION,

    -- Target variables (for supervised learning)
    pm10_next_24h_mean  DOUBLE PRECISION,
    pm25_next_24h_mean  DOUBLE PRECISION,
    o3_next_24h_max     DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_ml_air_quality_ready_date
    ON ml.air_quality_ready (date);
CREATE INDEX IF NOT EXISTS idx_ml_air_quality_ready_station
    ON ml.air_quality_ready (station_name);
CREATE INDEX IF NOT EXISTS idx_ml_air_quality_ready_city
    ON ml.air_quality_ready (city);

CREATE INDEX IF NOT EXISTS idx_raw_air_quality_date
    ON raw.air_quality (date);
CREATE INDEX IF NOT EXISTS idx_raw_air_quality_station
    ON raw.air_quality (station_name);
