import glob
import os
import sys

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.mlp_model import train_model as train_mlp


TARGETS = ["pm10_next_24h_mean", "pm25_next_24h_mean", "o3_next_24h_max"]
DROP_COLS = ["date", "station_name"]
CAT_COLS = ["city", "season"]


def load_data(data_path: str) -> pd.DataFrame:
    if os.path.isdir(data_path):
        part_files = sorted(glob.glob(os.path.join(data_path, "part-*.csv")))
        if part_files:
            return pd.concat(
                [pd.read_csv(f) for f in part_files], ignore_index=True
            )
    if data_path.endswith(".parquet"):
        return pd.read_parquet(data_path)
    return pd.read_csv(data_path)


def prepare_features(df: pd.DataFrame):
    df = df.dropna(subset=TARGETS).reset_index(drop=True)
    y = df[TARGETS].values
    X = df.drop(columns=TARGETS + DROP_COLS, errors="ignore")

    existing_cat = [c for c in CAT_COLS if c in X.columns]
    X = pd.get_dummies(X, columns=existing_cat, drop_first=False)

    null_counts = X.isnull().sum()
    null_cols = null_counts[null_counts > 0]
    if not null_cols.empty:
        print(f"[TRAIN] Filling {null_counts.sum():,} nulls across {len(null_cols)} columns")
        X = X.fillna(X.median(numeric_only=True))

    feature_columns = X.columns.tolist()

    return X.values.astype(np.float32), y.astype(np.float32), feature_columns


def train(data_path: str | None = None, output_dir: str | None = None):
    if output_dir is None:
        output_dir = os.environ.get("OUTPUT_DIR", "/workspace/output")

    if data_path is None:
        data_path = os.environ.get(
            "DATA_PATH", os.path.join(output_dir, "ml_air_quality.parquet")
        )

    print(f"[TRAIN] Loading data from {data_path}")
    df = load_data(data_path)

    if df.empty:
        print("[TRAIN] No data found. Skipping training.")
        return

    print(f"[TRAIN] Loaded {len(df):,} rows")

    X, y, feature_columns = prepare_features(df)
    print(f"[TRAIN] Feature matrix: {X.shape}  Targets: {y.shape}")

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"[TRAIN] Train: {len(X_train):,}  Val: {len(X_val):,}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    model, train_losses, val_losses = train_mlp(
        X_train_scaled,
        y_train,
        X_val_scaled,
        y_val,
        input_dim=X_train_scaled.shape[1],
    )

    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, "mlp_model.pt")
    state_path = os.path.join(output_dir, "mlp_state.pth")
    scaler_path = os.path.join(output_dir, "scaler.pkl")
    cols_path = os.path.join(output_dir, "feature_columns.pkl")

    model.eval()
    example = torch.randn(1, X_train_scaled.shape[1])
    traced = torch.jit.trace(model, example)
    traced.save(model_path)

    torch.save(model.state_dict(), state_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_columns, cols_path)

    with torch.no_grad():
        preds = model(torch.tensor(X_val_scaled, dtype=torch.float32)).numpy()

    rmse_per_target = np.sqrt(np.mean((preds - y_val) ** 2, axis=0))
    target_names = ["pm10", "pm25", "o3"]

    metrics_path = os.path.join(output_dir, "metrics.txt")
    with open(metrics_path, "w") as f:
        for name, rmse in zip(target_names, rmse_per_target):
            line = f"{name}: RMSE={rmse:.4f}\n"
            print(f"[TRAIN] {line.strip()}")
            f.write(line)

    print(f"[TRAIN] Model saved to {model_path}")
    print(f"[TRAIN] Scaler saved to {scaler_path}")
    print("[TRAIN] Training complete!")


if __name__ == "__main__":
    train()
