from pathlib import Path
import joblib
import pandas as pd

from sklearn.compose import make_column_transformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import KBinsDiscretizer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

from backend.features import (
    TARGET,
    DISCRETIZATION_FEATS,
    NUMERIC_FEATS,
    ORDINAL_FEATS,
    CATEGORICAL_FEATS,
    ENGINEERED_FEATS,
    add_engineered_features,
)


TARGET = "default.payment.next.month"



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


def build_preprocessor():
    """
    Build a preprocessing pipeline that applies
    appropriate transformation steps based on feature type.
    """
    return make_column_transformer(
        (KBinsDiscretizer(n_bins=5, encode="onehot"), discretization_feats),
        (StandardScaler(), numeric_feats + engineered_feats),  
        (OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), ordinal_feats),
        (OneHotEncoder(sparse_output=False, drop="if_binary", handle_unknown="ignore"), categorical_feats),
        remainder="drop",
    )

def main():
    df = pd.read_csv("backend/data/UCI_Credit_Card.csv")
    df = add_engineered_features(df)

    X = df.drop(columns=[TARGET])
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=123, stratify=y
    )

    preprocessor = build_preprocessor()
    model = LogisticRegression(max_iter=5000, class_weight="balanced")

    # pipe = make_pipeline(preprocessor, model)
    # pipe.fit(X_train, y_train)
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    joblib.dump(pipe, "model.joblib")


    # Check if running correctly, will remove
    print("Training complete")
    print("Training rows:", X_train.shape[0])
    print("Test rows:", X_test.shape[0])
    print("Features used:")
    print("discretization:", discretization_feats)
    print("numeric:", numeric_feats + engineered_feats)
    print("ordinal:", ordinal_feats)
    print("categorical:", categorical_feats)

    outdir = Path("models")
    outdir.mkdir(exist_ok=True)
    joblib.dump(pipe, outdir / "model.joblib")

    print("Saved:", outdir / "model.joblib")


if __name__ == "__main__":
    main()
