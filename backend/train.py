from pathlib import Path
import joblib
import pandas as pd

from sklearn.compose import make_column_transformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import KBinsDiscretizer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

TARGET = "default.payment.next.month"

discretization_feats = ["AGE", "LIMIT_BAL"]
numeric_feats = [
    "BILL_AMT1","BILL_AMT2","BILL_AMT3","BILL_AMT4","BILL_AMT5","BILL_AMT6",
    "PAY_AMT1","PAY_AMT2","PAY_AMT3","PAY_AMT4","PAY_AMT5","PAY_AMT6",
    "EDUCATION_MARRIAGE",
]
ordinal_feats = ["PAY_0","PAY_2","PAY_3","PAY_4","PAY_5","PAY_6"]
categorical_feats = ["SEX"]

def build_preprocessor():
    return make_column_transformer(
        (KBinsDiscretizer(n_bins=5, encode="onehot"), discretization_feats),
        (StandardScaler(), numeric_feats),
        (OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), ordinal_feats),
        (OneHotEncoder(handle_unknown="ignore", sparse_output=False, drop="if_binary"), categorical_feats),
        remainder="drop",
    )

def main():
    df = pd.read_csv("data/UCI_Credit_Card.csv")

    # Engineered feature
    df["EDUCATION_MARRIAGE"] = df["EDUCATION"] * 10 + df["MARRIAGE"]

    # Drop these features
    df = df.drop(columns=["EDUCATION", "MARRIAGE"])

    X = df.drop(columns=[TARGET])
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=123, stratify=y
    )

    preprocessor = build_preprocessor()

    model = LogisticRegression(max_iter=5000, class_weight="balanced")

    pipe = make_pipeline(preprocessor, model)
    pipe.fit(X_train, y_train)

    outdir = Path("models")
    outdir.mkdir(exist_ok=True)
    joblib.dump(pipe, outdir / "model.joblib")

    print("Saved:", outdir / "model.joblib")

if __name__ == "__main__":
    main()
