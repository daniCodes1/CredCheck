from pathlib import Path
import joblib
import pandas as pd

from sklearn.compose import make_column_transformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import KBinsDiscretizer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

TARGET = "default.payment.next.month"

# Continuous features
discretization_feats = ["AGE", "LIMIT_BAL"]
# Monetary amounts, scaled
numeric_feats = [
    "BILL_AMT1","BILL_AMT2","BILL_AMT3","BILL_AMT4","BILL_AMT5","BILL_AMT6",
    "PAY_AMT1","PAY_AMT2","PAY_AMT3","PAY_AMT4","PAY_AMT5","PAY_AMT6",
]
# Repayment status
ordinal_feats = ["PAY_0","PAY_2","PAY_3","PAY_4","PAY_5","PAY_6"]
categorical_feats = ["SEX", "EDUCATION", "MARRIAGE"]
# Engineered numeric features using bill and payment behaviour
engineered_feats = ["util_1", "util_mean", "pay_to_bill_total"]


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create engineered features to summarize credit usage and repayment behavior. Captures ratios 
    and aggregates that are not directly present in the raw dataset but are related to default risk.
    """
    # Setup
    df = df.copy()
    bill_cols = [f"BILL_AMT{i}" for i in range(1, 7)]
    pay_cols = [f"PAY_AMT{i}" for i in range(1, 7)]
    limit = df["LIMIT_BAL"].replace(0, pd.NA) # Prevent division by 0

    # Feature creation
    df["util_1"] = df["BILL_AMT1"] / limit # 1. How much of their credit was used up?
    df["util_mean"] = df[bill_cols].div(limit, axis=0).mean(axis=1) # 2. Average credit utilizaiton behaviour

    total_bill = df[bill_cols].sum(axis=1)
    total_pay = df[pay_cols].sum(axis=1)
    df["pay_to_bill_total"] = total_pay / (total_bill) # 3. Proportion of total bills that were paid

    # Cleanup
    df[engineered_feats] = df[engineered_feats].replace([float("inf"), float("-inf")], pd.NA)
    df[engineered_feats] = df[engineered_feats].fillna(0.0)
    return df

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

    pipe = make_pipeline(preprocessor, model)
    pipe.fit(X_train, y_train)

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
