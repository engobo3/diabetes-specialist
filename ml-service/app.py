"""
Diabetic Foot Risk Prediction Service
Flask API serving LightGBM predictions (or rule-based fallback).
Deployed to Google Cloud Run.
"""
import os
import numpy as np
from flask import Flask, request, jsonify
from scoring.rule_based import predict_foot_risk, _generate_recommendations, RISK_LABELS as ML_RISK_LABELS

app = Flask(__name__)

REQUIRED_FIELDS = [
    "hba1c", "crp", "creatinine", "albumin",
    "esr", "sodium", "age", "diabetes_duration_years"
]

FEATURE_NAMES = [
    "hba1c", "crp", "creatinine", "albumin", "esr", "sodium",
    "age", "diabetes_duration_years",
    "has_hypertension", "has_neuropathy", "has_pvd"
]

RISK_LEVEL_NAMES = ["low", "moderate", "high"]

# --- Model loading ---
_regressor = None
_classifier = None
_explainer = None
_model_loaded = False

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


def _load_models():
    """Try to load LightGBM models and SHAP explainer at startup."""
    global _regressor, _classifier, _explainer, _model_loaded

    reg_path = os.path.join(MODELS_DIR, "foot_risk_regressor.pkl")
    clf_path = os.path.join(MODELS_DIR, "foot_risk_classifier.pkl")
    shap_path = os.path.join(MODELS_DIR, "shap_explainer.pkl")

    if os.path.exists(reg_path) and os.path.exists(clf_path):
        import joblib
        _regressor = joblib.load(reg_path)
        _classifier = joblib.load(clf_path)
        if os.path.exists(shap_path):
            _explainer = joblib.load(shap_path)
        _model_loaded = True
        app.logger.info("LightGBM models loaded successfully")
    else:
        app.logger.info("No LightGBM models found, using rule-based fallback")


def _predict_lightgbm(data, lang="fr"):
    """Run prediction through LightGBM models with SHAP explainability."""
    import pandas as pd

    # Build feature vector in correct order
    features = {
        "hba1c": data["hba1c"],
        "crp": data["crp"],
        "creatinine": data["creatinine"],
        "albumin": data["albumin"],
        "esr": data["esr"],
        "sodium": data["sodium"],
        "age": data["age"],
        "diabetes_duration_years": data["diabetes_duration_years"],
        "has_hypertension": int(data.get("has_hypertension", False)),
        "has_neuropathy": int(data.get("has_neuropathy", False)),
        "has_pvd": int(data.get("has_pvd", False)),
    }

    X = pd.DataFrame([features])

    # Regressor: continuous risk score
    raw_score = _regressor.predict(X)[0]
    risk_score = int(np.clip(np.round(raw_score), 0, 100))

    # Classifier: risk level
    class_idx = _classifier.predict(X)[0]
    risk_level = RISK_LEVEL_NAMES[class_idx]
    labels = ML_RISK_LABELS.get(lang, ML_RISK_LABELS["fr"])
    risk_label = labels[risk_level]

    # SHAP values for explainability
    shap_values = None
    if _explainer is not None:
        try:
            sv = _explainer.shap_values(X)
            shap_dict = {}
            for i, fname in enumerate(FEATURE_NAMES):
                shap_dict[fname] = round(float(sv[0][i]), 3)
            shap_values = shap_dict
        except Exception as e:
            app.logger.warning(f"SHAP computation failed: {e}")

    # Recommendations (reuse the clinically-validated rule-based logic)
    recommendations = _generate_recommendations(data, risk_score, risk_level, lang)

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "shap_values": shap_values,
        "recommendations": recommendations,
        "model_version": "lightgbm_v1",
        "fallback": False,
    }


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # Validate required fields
    missing = [f for f in REQUIRED_FIELDS if f not in data or data[f] is None]
    if missing:
        return jsonify({"error": "Champs manquants", "details": missing}), 400

    # Convert numeric fields
    try:
        for field in REQUIRED_FIELDS:
            data[field] = float(data[field])
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Valeur invalide: {e}"}), 400

    # Ensure boolean fields
    for bool_field in ["has_hypertension", "has_neuropathy", "has_pvd"]:
        data[bool_field] = bool(data.get(bool_field, False))

    lang = data.pop("lang", "fr")

    # Use LightGBM if available, otherwise rule-based
    if _model_loaded:
        try:
            result = _predict_lightgbm(data, lang)
        except Exception as e:
            app.logger.error(f"LightGBM prediction failed: {e}, falling back to rule-based")
            result = predict_foot_risk(data, lang)
    else:
        result = predict_foot_risk(data, lang)

    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    model_name = "lightgbm_v1" if _model_loaded else "rule_based_v1"
    return jsonify({
        "status": "ok",
        "model": model_name,
        "shap_available": _explainer is not None
    })


# Load models on startup
_load_models()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
