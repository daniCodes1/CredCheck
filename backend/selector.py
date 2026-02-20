import pandas as pd
import numpy as np
from sklearn.feature_selection import SelectFromModel, RFE
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_validate

# This module will implement feature selection techniques like Model-based selection 
# and Recursive Feature Elimination (RFE) to identify the most important features and reduce noise.

def run_model_based_selection(X_train, y_train, preprocessor):
    """
    Tries different thresholds for Model-based selection.
    """
    thresholds = ["median", "mean", 0.01]
    results = []
    
    for threshold in thresholds:
        print(f"Evaluating Model-based with threshold: {threshold}")
        select_rf = SelectFromModel(
            RandomForestClassifier(n_estimators=100, random_state=42), 
            threshold=threshold,
        )
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        pipe = make_pipeline(preprocessor, select_rf, rf) 
        
        scores = cross_validate(pipe, X_train, y_train, return_train_score=True)
        results.append({
            "threshold": threshold,
            "train_score_mean": scores['train_score'].mean(),
            "test_score_mean": scores['test_score'].mean(),
            "test_score_std": scores['test_score'].std()
        })

    results_df = pd.DataFrame(results)
    print("\nModel-based selection results:")
    print(results_df)
    return results_df

def run_rfe_selection(X_train, y_train, preprocessor, model):
    """
    Tries different feature counts for Recursive Feature Elimination.
    """
    n_values_to_select = [15, 18, 20, 22, 23] # There are 24 in total
    results = []

    for n in n_values_to_select:
        print(f"Evaluating RFE with n_features = {n}")
        # LogisticRegression as the ranker
        # Considr using model based selection to pre-select as well and find the best 
        rfe = RFE(LogisticRegression(max_iter=1000), n_features_to_select=int(n), step=1) 
        # pipe_rfe = make_pipeline(preprocessor, rfe, RandomForestClassifier(n_estimators=100, random_state=42))
        pipe_rfe = make_pipeline(preprocessor, rfe, model)
        scores_rfe = cross_validate(pipe_rfe, X_train, y_train, return_train_score=True)
        results.append({
            'n_features': n,
            'mean_test_score': np.mean(scores_rfe['test_score']),
            'mean_train_score': np.mean(scores_rfe['train_score']),
            'mean_fit_time': np.mean(scores_rfe['fit_time']),
        })

    results_df = pd.DataFrame(results)
    print("\nRecursive feature elimination results:")
    print(results_df)
    
    # Fit only the best performing RFE configuration
    best_n = int(results_df.loc[results_df['mean_test_score'].idxmax()]['n_features'])
    print(f"Best n_features from RFE: {best_n}")

    final_rfe = RFE(estimator=LogisticRegression(max_iter=1000), n_features_to_select=best_n, step=1)
    pipe = make_pipeline(preprocessor, final_rfe, model)

    pipe.fit(X_train, y_train)
    scores = cross_validate(pipe, X_train, y_train, return_train_score=True)

    print("Best results from RFE:")
    print(pd.DataFrame(scores))
    
    return results_df, pipe