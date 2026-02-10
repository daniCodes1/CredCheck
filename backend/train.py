from pathlib import Path
import argparse
import joblib
import numpy as np
import pandas as pd

from sklearn.compose import make_column_transformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import KBinsDiscretizer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, GridSearchCV

from features import (
    TARGET,
    DISCRETIZATION_FEATS,
    NUMERIC_FEATS,
    ORDINAL_FEATS,
    CATEGORICAL_FEATS,
    ENGINEERED_FEATS,
    add_engineered_features,
)

# Helper function
def build_pipeline():
    preprocessor = make_column_transformer(
        (KBinsDiscretizer(n_bins=5, encode="onehot"), DISCRETIZATION_FEATS),
        (StandardScaler(), NUMERIC_FEATS + ENGINEERED_FEATS),
        (OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), ORDINAL_FEATS),
        (OneHotEncoder(sparse_output=False, drop="if_binary", handle_unknown="ignore"), CATEGORICAL_FEATS),
        remainder="drop",
    )

    model = LogisticRegression(
        max_iter=5000,
        class_weight="balanced",
    )

    return make_pipeline(preprocessor, model)


def load_data(file_path):
    print(f"Loading data from {file_path}...")
    df = pd.read_csv(file_path)
    df = add_engineered_features(df)
    
    X = df.drop(columns=[TARGET])
    y = df[TARGET]
    
    return train_test_split(
        X, y, test_size=0.3, random_state=123, stratify=y
    )

def run_hyperparameter_tuning(pipe, X_train, y_train):
    print("Running hyperparameter tuning (GridSearchCV)...")
    param_grid = {
        "logisticregression__C": np.logspace(-4, 4, 10)
    }
    grid_search = GridSearchCV(
        pipe,
        param_grid,
        cv=5,
        scoring="accuracy",
        return_train_score=True
    )
    grid_search.fit(X_train, y_train)
    
    print(f"Best hyperparameters: {grid_search.best_params_}")
    print(f"Best CV score: {grid_search.best_score_:.4f}")
    return grid_search.best_estimator_


def main():
    print("Starting training...")

    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true") # currently running with python3 backend/train.py --tune
    args = parser.parse_args()

    X_train, X_test, y_train, y_test = load_data('backend/data/UCI_Credit_Card.csv')
    pipe = build_pipeline()

    print("Build successfully. Features used:")
    print("  Discretized:", DISCRETIZATION_FEATS)
    print("  Numeric + engineered:", NUMERIC_FEATS + ENGINEERED_FEATS)
    print("  Ordinal:", ORDINAL_FEATS)
    print("  Categorical:", CATEGORICAL_FEATS)

    if args.tune:
        pipe = run_hyperparameter_tuning(pipe, X_train, y_train)
    else:
        print("Training model with default parameters...")
        pipe.fit(X_train, y_train)

    outdir = Path("models")
    outdir.mkdir(exist_ok=True)
    joblib.dump(pipe, outdir / "model.joblib")
    print("Saved:", outdir / "model.joblib")

if __name__ == "__main__":
    main()

