from pathlib import Path
import argparse
from re import search
import joblib
import numpy as np
import pandas as pd

from selector import run_rfe_selection
from sklearn.compose import make_column_transformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import KBinsDiscretizer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier 
from sklearn.model_selection import cross_validate, train_test_split, GridSearchCV, RandomizedSearchCV

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
def build_pipeline(model_type="logistic"):
    preprocessor = make_column_transformer(
        (KBinsDiscretizer(n_bins=5, encode="onehot", strategy='quantile', quantile_method='averaged_inverted_cdf'), DISCRETIZATION_FEATS),
        (StandardScaler(), NUMERIC_FEATS + ENGINEERED_FEATS),
        (OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), ORDINAL_FEATS),
        (OneHotEncoder(sparse_output=False, drop="if_binary", handle_unknown="ignore"), CATEGORICAL_FEATS),
        remainder="drop",
    )
    if model_type == "rf":
        model = RandomForestClassifier(random_state=123, class_weight="balanced")
        # Random Forests can have high training scores, each individual tree grows deep to capture complex interactions
        # but it's normal and the ensemble averages out to prevent overfitting. opt for more trees when possible
    elif model_type == "svm":
        # SVM can be slow  because of size of dataset, maybe use a smaller c / linear kernel
        model = SVC(kernel="rbf", class_weight="balanced", probability=True)
    elif model_type == "knn":
        model = KNeighborsClassifier()
    else:
        model = LogisticRegression(max_iter=5000, class_weight="balanced")

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

def run_hyperparameter_tuning(pipe, X_train, y_train, model_type="logistic", search_type = "grid"):
    print("Runs either GridSearchCV or RandomizedSearchCV based on search_type parameter")
    print(f"Running {search_type} for {model_type}...")
    model_step_name = pipe.steps[-1][0]
    
    if model_type == "rf":
        param_dist = {
            f"{model_step_name}__n_estimators": np.arange(10, 200, 10),
            f"{model_step_name}__max_depth": [None] + list(np.arange(5, 20, 5)),
            f"{model_step_name}__min_samples_split": [2, 5, 10],
            f"{model_step_name}__max_features": ['sqrt', 'log2'],
            # f"{model_step_name}__min_samples_leaf": [1, 2, 5] # more sensitive? try small values
        }
    elif model_type == "logistic":
        param_dist = {
            f"{model_step_name}__C": np.logspace(-4, 4, 20)
        }
    else:
        param_dist = {} # Use default for other models

    if search_type == "random":
        search = RandomizedSearchCV(
            pipe, 
            param_distributions=param_dist, 
            n_iter=10, 
            cv=5, 
            scoring='accuracy', 
            random_state=42,
            n_jobs=-1,
            return_train_score=True
        )
    else:
        search = GridSearchCV(
            pipe, 
            param_grid=param_dist, 
            cv=5, 
            scoring='accuracy', 
            n_jobs=-1,
            return_train_score=True
        )

    search.fit(X_train, y_train)
    
    # Just for printing purposes for now:
    import json
    print("Best hyperparameters:", json.loads(json.dumps(search.best_params_, default=float)))
    # print(f"Best hyperparameters: {grid_search.best_params_}")
    print("Best CV score:", json.loads(json.dumps(search.best_score_, default=float)))
    # print(f"Best CV score: {grid_search.best_score_:.4f}")

    return search.best_estimator_

def main():
    print("Starting training...")

    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true") # currently running with python3 backend/train.py --tune
    parser.add_argument("--model", type=str, default="logistic", choices=["logistic", "rf", "svm", "knn"])
    args = parser.parse_args()

    # Load and build original pipe
    X_train, X_test, y_train, y_test = load_data('backend/data/UCI_Credit_Card.csv')

    # Find the best performing model 
    model_types = ["logistic", "rf", "knn", "svm"]
    model_performance = {}

    for m_type in model_types:
        temp_pipe = build_pipeline(model_type=m_type)
        scores = cross_validate(temp_pipe, X_train, y_train, cv=5)
        mean_score = np.mean(scores['test_score'])
        model_performance[m_type] = mean_score
        print(f"{m_type}: {mean_score:.4f}")
    
    best_model_type = max(model_performance, key=model_performance.get)
    print(f"\nModel selected: {best_model_type.upper()} ({model_performance[best_model_type]:.4f})")

    pipe = build_pipeline(model_type=best_model_type)
    preprocessor = pipe.named_steps['columntransformer']
    model_inst = pipe.steps[-1][1]

    # Run feature selection (RFE) to simplify the best model and evaluate performance
    rfe_results, best_pipe = run_rfe_selection(X_train, y_train, preprocessor, model_inst)
    baseline_score = model_performance[best_model_type]
    best_n = int(rfe_results.loc[rfe_results['mean_test_score'].idxmax()]['n_features'])
    # threshold = -0.01
    best_rfe_score = rfe_results['mean_test_score'].max()
    if best_rfe_score < (baseline_score - 0.005):        
        print("No significant improvement from RFE, changing to baseline model")
        pipe = build_pipeline(model_type=best_model_type)
        pipe.fit(X_train, y_train)
    else:
        best_n = int(rfe_results.loc[rfe_results['mean_test_score'].idxmax()]['n_features'])
        print(f"Keeping RFE pipeline (n={best_n}).")

    if args.tune:
        # pipe = run_hyperparameter_tuning(pipe, X_train, y_train)
        pipe = run_hyperparameter_tuning(pipe, X_train, y_train, model_type=best_model_type)
    else:
        print("Training model with default parameters...")
        pipe.fit(X_train, y_train)

    outdir = Path("models")
    outdir.mkdir(exist_ok=True)
    joblib.dump(pipe, outdir / "model.joblib")
    print("Saved:", outdir / "model.joblib")

if __name__ == "__main__":
    main()

