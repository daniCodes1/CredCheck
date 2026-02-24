from pathlib import Path
import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.features import add_engineered_features

# MODEL_PATH = Path(__file__).resolve().parent / "models" / "model.joblib"
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "model.joblib"

app = FastAPI(title="Credit Default Predictor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load(MODEL_PATH)

class PredictRequest(BaseModel):
    LIMIT_BAL: float
    AGE: float
    SEX: int
    EDUCATION: int
    MARRIAGE: int

    PAY_0: int
    PAY_2: int
    PAY_3: int
    PAY_4: int
    PAY_5: int
    PAY_6: int

    BILL_AMT1: float
    BILL_AMT2: float
    BILL_AMT3: float
    BILL_AMT4: float
    BILL_AMT5: float
    BILL_AMT6: float

    PAY_AMT1: float
    PAY_AMT2: float
    PAY_AMT3: float
    PAY_AMT4: float
    PAY_AMT5: float
    PAY_AMT6: float

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/predict")
def predict(req: PredictRequest):
    df = pd.DataFrame([req.model_dump()])
    df = add_engineered_features(df)
    proba = float(model.predict_proba(df)[0][1])
    pred = int(proba >= 0.5)
    return {"default_probability": proba, "predicted_label": pred}
