from __future__ import annotations
import pandas as pd

"""
Feature engineering utilities
"""

TARGET = "default.payment.next.month"

# Continuous features
DISCRETIZATION_FEATS = ["AGE"]

# Monetary amounts, scaled
NUMERIC_FEATS = [
    "BILL_AMT1","BILL_AMT2","BILL_AMT3","BILL_AMT4","BILL_AMT5","BILL_AMT6",
    "PAY_AMT1","PAY_AMT2","PAY_AMT3","PAY_AMT4","PAY_AMT5","PAY_AMT6", "LIMIT_BAL"
]

ORDINAL_FEATS = ["PAY_0","PAY_2","PAY_3","PAY_4","PAY_5","PAY_6"]
CATEGORICAL_FEATS = ["SEX", "EDUCATION", "MARRIAGE"]

# Engineered numeric features
ENGINEERED_FEATS = ["util_1", "util_mean", "pay_to_bill_total"]


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create engineered features to summarize credit usage and repayment behavior.
    Captures ratios and aggregates that are not directly present in the raw dataset
    but are related to default risk.
    """
    # Setup
    df = df.copy()
    bill_cols = [f"BILL_AMT{i}" for i in range(1, 7)]
    pay_cols = [f"PAY_AMT{i}" for i in range(1, 7)]
    limit = df["LIMIT_BAL"].replace(0, pd.NA)  # Prevent division by 0

    # Feature creation
    df["util_1"] = df["BILL_AMT1"] / limit  # 1. How much of their credit was used?
    df["util_mean"] = df[bill_cols].div(limit, axis=0).mean(axis=1)  # 2. Avg utilization

    total_bill = df[bill_cols].sum(axis=1)
    total_pay = df[pay_cols].sum(axis=1)
    df["pay_to_bill_total"] = total_pay / total_bill  # 3. Repayment proportion

    # Average amounts
    bill_cols = [f'BILL_AMT{i}' for i in range(1, 7)]
    pay_cols = [f'PAY_AMT{i}' for i in range(1, 7)]
    
    df['bill_avg'] = df[bill_cols].mean(axis=1)
    df['pay_avg'] = df[pay_cols].mean(axis=1)

    # Cleanup
    df[ENGINEERED_FEATS] = df[ENGINEERED_FEATS].replace(
        [float("inf"), float("-inf")], pd.NA
    )
    df[ENGINEERED_FEATS] = df[ENGINEERED_FEATS].fillna(0.0)

    return df

