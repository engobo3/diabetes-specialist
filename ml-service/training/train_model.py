"""
Train LightGBM models for diabetic foot risk prediction.

Produces:
  - foot_risk_regressor.pkl   (continuous risk score 0-100)
  - foot_risk_classifier.pkl  (3-class: low/moderate/high)
  - shap_explainer.pkl        (SHAP TreeExplainer for feature importance)
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, r2_score,
    classification_report, confusion_matrix, roc_auc_score
)
from imblearn.over_sampling import SMOTE
import shap

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "synthetic_data.csv")
MODELS_DIR = os.path.join(SCRIPT_DIR, "..", "models")

FEATURE_COLS = [
    "hba1c", "crp", "creatinine", "albumin", "esr", "sodium",
    "age", "diabetes_duration_years",
    "has_hypertension", "has_neuropathy", "has_pvd"
]

RISK_LEVEL_MAP = {"low": 0, "moderate": 1, "high": 2}
RISK_LEVEL_NAMES = ["low", "moderate", "high"]


def load_data():
    """Load and prepare training data."""
    if not os.path.exists(DATA_PATH):
        print("Synthetic data not found. Generating...")
        from generate_data import generate_dataset
        df = generate_dataset()
        df.to_csv(DATA_PATH, index=False)
    else:
        df = pd.read_csv(DATA_PATH)

    X = df[FEATURE_COLS].copy()
    y_score = df["risk_score"].values
    y_class = df["risk_level"].map(RISK_LEVEL_MAP).values

    return X, y_score, y_class


def train_regressor(X_train, X_test, y_train, y_test):
    """Train LightGBM regressor for continuous risk score."""
    print("\n" + "=" * 60)
    print("TRAINING REGRESSOR (Risk Score 0-100)")
    print("=" * 60)

    model = lgb.LGBMRegressor(
        n_estimators=300,
        num_leaves=31,
        learning_rate=0.05,
        max_depth=-1,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        verbose=-1
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.log_evaluation(period=0)]
    )

    preds = model.predict(X_test)
    preds_clipped = np.clip(np.round(preds), 0, 100)

    mae = mean_absolute_error(y_test, preds_clipped)
    r2 = r2_score(y_test, preds_clipped)

    print(f"\nRegressor Performance:")
    print(f"  MAE:  {mae:.2f} points")
    print(f"  R2:   {r2:.4f}")

    return model


def train_classifier(X_train, X_test, y_train, y_test):
    """Train LightGBM classifier with SMOTE for class imbalance."""
    print("\n" + "=" * 60)
    print("TRAINING CLASSIFIER (low / moderate / high)")
    print("=" * 60)

    # Apply SMOTE for class imbalance
    print(f"\nClass distribution before SMOTE:")
    unique, counts = np.unique(y_train, return_counts=True)
    for u, c in zip(unique, counts):
        print(f"  {RISK_LEVEL_NAMES[u]}: {c}")

    smote = SMOTE(random_state=42)
    X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

    print(f"\nClass distribution after SMOTE:")
    unique, counts = np.unique(y_resampled, return_counts=True)
    for u, c in zip(unique, counts):
        print(f"  {RISK_LEVEL_NAMES[u]}: {c}")

    model = lgb.LGBMClassifier(
        n_estimators=300,
        num_leaves=31,
        learning_rate=0.05,
        max_depth=-1,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        class_weight="balanced",
        random_state=42,
        verbose=-1
    )

    model.fit(
        X_resampled, y_resampled,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.log_evaluation(period=0)]
    )

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)

    print(f"\nClassification Report:")
    print(classification_report(y_test, preds, target_names=RISK_LEVEL_NAMES))

    print(f"Confusion Matrix:")
    cm = confusion_matrix(y_test, preds)
    print(f"  {'':>10} {'low':>8} {'moderate':>8} {'high':>8}")
    for i, row in enumerate(cm):
        print(f"  {RISK_LEVEL_NAMES[i]:>10} {row[0]:>8} {row[1]:>8} {row[2]:>8}")

    # AUC (one-vs-rest)
    try:
        auc = roc_auc_score(y_test, proba, multi_class="ovr", average="weighted")
        print(f"\n  Weighted AUC: {auc:.4f}")
    except Exception:
        pass

    return model


def build_shap_explainer(model, X_sample):
    """Build SHAP TreeExplainer for the regressor model."""
    print("\n" + "=" * 60)
    print("BUILDING SHAP EXPLAINER")
    print("=" * 60)

    explainer = shap.TreeExplainer(model)

    # Verify it works on a sample
    sample = X_sample.iloc[:5]
    sv = explainer.shap_values(sample)
    print(f"  SHAP values shape: {np.array(sv).shape}")
    print(f"  Feature names: {FEATURE_COLS}")
    print(f"  Sample SHAP values (first patient):")
    for fname, val in zip(FEATURE_COLS, sv[0]):
        direction = "+" if val > 0 else ""
        print(f"    {fname:>25}: {direction}{val:.2f}")

    return explainer


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Load data
    X, y_score, y_class = load_data()
    print(f"Dataset: {len(X)} samples, {len(FEATURE_COLS)} features")

    # Split
    X_train, X_test, ys_train, ys_test, yc_train, yc_test = train_test_split(
        X, y_score, y_class, test_size=0.2, random_state=42, stratify=y_class
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Train models
    regressor = train_regressor(X_train, X_test, ys_train, ys_test)
    classifier = train_classifier(X_train, X_test, yc_train, yc_test)

    # SHAP explainer (based on regressor for continuous feature contributions)
    explainer = build_shap_explainer(regressor, X_test)

    # Save
    reg_path = os.path.join(MODELS_DIR, "foot_risk_regressor.pkl")
    clf_path = os.path.join(MODELS_DIR, "foot_risk_classifier.pkl")
    shap_path = os.path.join(MODELS_DIR, "shap_explainer.pkl")

    joblib.dump(regressor, reg_path)
    joblib.dump(classifier, clf_path)
    joblib.dump(explainer, shap_path)

    print(f"\n{'=' * 60}")
    print(f"MODELS SAVED")
    print(f"{'=' * 60}")
    print(f"  Regressor:  {reg_path}")
    print(f"  Classifier: {clf_path}")
    print(f"  SHAP:       {shap_path}")
    print(f"\nDone!")


if __name__ == "__main__":
    main()
