from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable
import pandas as pd

"""
Feature engineering utilities
"""


TARGET = "default.payment.next.month"

class FeatureGroups:
    # Column groupings
    discretization_feats: tuple[str, ...] = ("AGE", "LIMIT_BAL")
    numeric_feats: tuple[str, ...] = (
        "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6",
        "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6",
    )
    ordinal_feats: tuple[str, ...] = (
        "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"
    )
    categorical_feats: tuple[str, ...] = (
        "SEX",
        "EDUCATION",
        "MARRIAGE",
    )


FEATURES = FeatureGroups()


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    return df
