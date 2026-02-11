"""
Generate synthetic diabetic foot risk data for LightGBM training.

Biomarker distributions are based on clinical literature for diabetic populations.
Risk scores incorporate non-linear interactions between biomarkers, reflecting
real-world clinical patterns (e.g., neuropathy + high HbA1c = multiplicative risk).
"""
import numpy as np
import pandas as pd
import os

SEED = 42
N_SAMPLES = 5000

FEATURE_NAMES = [
    "hba1c", "crp", "creatinine", "albumin", "esr", "sodium",
    "age", "diabetes_duration_years",
    "has_hypertension", "has_neuropathy", "has_pvd"
]


def generate_biomarkers(n, rng):
    """Generate realistic biomarker distributions for diabetic patients."""
    data = pd.DataFrame()

    # HbA1c (%): diabetic population skews higher than general (mean ~7.5)
    data["hba1c"] = np.clip(rng.normal(7.5, 1.8, n), 4.0, 15.0)

    # CRP (mg/L): log-normal, most patients low, some very high (inflammation)
    data["crp"] = np.clip(rng.lognormal(mean=1.0, sigma=1.0, size=n), 0.1, 100.0)

    # Creatinine (mg/dL): slightly elevated in diabetic population
    data["creatinine"] = np.clip(rng.normal(1.2, 0.6, n), 0.4, 10.0)

    # Albumin (g/dL): lower = malnourished / nephrotic
    data["albumin"] = np.clip(rng.normal(3.8, 0.7, n), 1.5, 5.5)

    # ESR (mm/h): log-normal, elevated with inflammation
    data["esr"] = np.clip(rng.lognormal(mean=2.5, sigma=0.7, size=n), 1.0, 120.0)

    # Sodium (mEq/L): mostly normal, some hyponatremia
    data["sodium"] = np.clip(rng.normal(139, 4, n), 120, 155)

    # Age: diabetic foot patients skew older
    data["age"] = np.clip(rng.normal(58, 15, n), 18, 95).astype(int)

    # Diabetes duration (years)
    data["diabetes_duration_years"] = np.clip(rng.exponential(10, n), 0, 45).astype(int)

    # Boolean comorbidities with realistic prevalence
    data["has_hypertension"] = rng.binomial(1, 0.60, n)
    data["has_neuropathy"] = rng.binomial(1, 0.30, n)
    data["has_pvd"] = rng.binomial(1, 0.20, n)

    # Correlation: longer duration → higher neuropathy/PVD prevalence
    long_duration = data["diabetes_duration_years"] > 15
    data.loc[long_duration & (rng.random(n) < 0.4), "has_neuropathy"] = 1
    data.loc[long_duration & (rng.random(n) < 0.25), "has_pvd"] = 1

    # Correlation: older + hypertension more likely
    older = data["age"] > 65
    data.loc[older & (rng.random(n) < 0.3), "has_hypertension"] = 1

    return data


def compute_risk_score(row):
    """
    Compute a clinically-informed risk score (0-100) with non-linear interactions.
    Goes beyond simple additive scoring to capture real clinical patterns.
    """
    score = 0.0

    # --- Base biomarker contributions (similar to rule-based but continuous) ---

    # HbA1c: exponential risk above 7.5
    hba1c = row["hba1c"]
    if hba1c >= 9.0:
        score += 18 + (hba1c - 9.0) * 2  # accelerating risk
    elif hba1c >= 7.5:
        score += 8 + (hba1c - 7.5) * 6.67
    elif hba1c >= 6.5:
        score += 3 + (hba1c - 6.5) * 5
    else:
        score += max(0, (hba1c - 4.0) * 1.2)

    # CRP: log-scaled inflammation marker
    crp = row["crp"]
    score += min(15, np.log1p(crp) * 3.2)

    # Creatinine: kidney function
    creat = row["creatinine"]
    if creat >= 2.0:
        score += 14
    elif creat >= 1.3:
        score += 5 + (creat - 1.3) * 12.86
    elif creat >= 1.0:
        score += (creat - 1.0) * 16.67

    # Albumin: inverse relationship (low = bad)
    alb = row["albumin"]
    if alb < 2.5:
        score += 10
    elif alb < 3.5:
        score += 10 - (alb - 2.5) * 4
    else:
        score += max(0, 2 - (alb - 3.5) * 2)

    # ESR: log-scaled
    esr = row["esr"]
    score += min(10, np.log1p(esr) * 2.0)

    # Sodium: hyponatremia risk
    na = row["sodium"]
    if na < 130:
        score += 5
    elif na < 135:
        score += (135 - na) * 0.6

    # Age: gradual increase
    age = row["age"]
    if age >= 70:
        score += 9
    elif age >= 60:
        score += 4 + (age - 60) * 0.5
    elif age >= 50:
        score += (age - 50) * 0.4

    # Duration: gradual increase
    dur = row["diabetes_duration_years"]
    score += min(14, dur * 0.7)

    # --- Boolean comorbidities ---
    if row["has_neuropathy"]:
        score += 5
    if row["has_pvd"]:
        score += 5
    if row["has_hypertension"]:
        score += 3

    # --- NON-LINEAR INTERACTIONS (what makes LightGBM valuable) ---

    # Neuropathy + poor glycemic control = multiplicative risk
    if row["has_neuropathy"] and hba1c >= 8.0:
        score += 6 * (1 + (hba1c - 8.0) * 0.3)

    # PVD + low albumin = poor healing capacity
    if row["has_pvd"] and alb < 3.5:
        score += 5 * (1 + (3.5 - alb) * 0.8)

    # Elderly + long duration = compounding risk
    if age >= 65 and dur >= 15:
        score += 4

    # Triple threat: neuropathy + PVD + inflammation
    if row["has_neuropathy"] and row["has_pvd"] and crp >= 5:
        score += 7

    # Renal + inflammation synergy
    if creat >= 1.5 and crp >= 5:
        score += 4

    # Hypertension + PVD = vascular synergy
    if row["has_hypertension"] and row["has_pvd"]:
        score += 3

    return score


def generate_dataset(n=N_SAMPLES, seed=SEED):
    """Generate full labeled dataset."""
    rng = np.random.default_rng(seed)
    data = generate_biomarkers(n, rng)

    # Compute deterministic risk scores
    raw_scores = data.apply(compute_risk_score, axis=1)

    # Add Gaussian noise for realism (clinical measurement variability)
    noise = rng.normal(0, 3.0, n)
    data["risk_score"] = np.clip(np.round(raw_scores + noise), 0, 100).astype(int)

    # Classify into risk levels
    data["risk_level"] = pd.cut(
        data["risk_score"],
        bins=[-1, 30, 60, 100],
        labels=["low", "moderate", "high"]
    )

    return data


if __name__ == "__main__":
    print("Generating synthetic diabetic foot risk dataset...")
    df = generate_dataset()

    # Print distribution summary
    print(f"\nTotal samples: {len(df)}")
    print(f"\nRisk level distribution:")
    print(df["risk_level"].value_counts().sort_index())
    print(f"\nRisk score statistics:")
    print(df["risk_score"].describe())
    print(f"\nFeature statistics:")
    print(df[FEATURE_NAMES].describe().round(2))

    # Save
    out_path = os.path.join(os.path.dirname(__file__), "synthetic_data.csv")
    df.to_csv(out_path, index=False)
    print(f"\nSaved to {out_path}")
