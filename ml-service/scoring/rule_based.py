"""
Rule-based diabetic foot risk scorer.
Uses weighted clinical thresholds to produce a 0-100 risk score.
Designed to be API-compatible with the LightGBM model for seamless swap.
"""

RISK_LABELS = {
    "fr": {"low": "Risque Faible", "moderate": "Risque Modere", "high": "Risque Eleve"},
    "ln": {"low": "Likama moke", "moderate": "Likama ya kati", "high": "Likama makasi"},
    "sw": {"low": "Hatari ndogo", "moderate": "Hatari ya wastani", "high": "Hatari kubwa"},
    "tsh": {"low": "Mpata wa panshi", "moderate": "Mpata wa pakati", "high": "Mpata wa muulu"},
    "kg": {"low": "Nsaku ya fioti", "moderate": "Nsaku ya kati", "high": "Nsaku ya nene"},
}

RECS = {
    "fr": {
        "urgent": "Consultation podologique urgente recommandee",
        "exam": "Examen des pieds a chaque consultation",
        "hba1c": "Controle HbA1c a intensifier (objectif < 7%)",
        "crp": "Surveillance CRP - inflammation detectee",
        "kidney": "Evaluation de la fonction renale recommandee",
        "nutrition": "Evaluation nutritionnelle recommandee (albumine basse)",
        "esr": "VS elevee - rechercher une infection ou inflammation",
        "neuropathy": "Neuropathie detectee - chaussures therapeutiques recommandees",
        "pvd": "Arteriopathie - echo-Doppler arteriel recommande",
        "hygiene": "Hygiene des pieds quotidienne et chaussures adaptees",
    },
    "ln": {
        "urgent": "Kokende na monganga ya makolo na lombangu esengami",
        "exam": "Kotala makolo na consultation nionso",
        "hba1c": "Boyekoli HbA1c esengeli koleka makasi (mokano < 7%)",
        "crp": "Kolandela CRP - nzoto epeli emonani",
        "kidney": "Bomeki ya bamfigo esengami",
        "nutrition": "Bomeki ya bilei esengami (albumine ekiti)",
        "esr": "VS etomboki - koluka bokono to nzoto epeli",
        "neuropathy": "Bokono ya misisa emonani - sapato ya minganga esengami",
        "pvd": "Bokono ya mituka ya makila - echo-Doppler esengami",
        "hygiene": "Bopeto ya makolo mokolo na mokolo mpe sapato ya malamu",
    },
    "sw": {
        "urgent": "Mashauriano ya haraka ya daktari wa miguu yanapendekezwa",
        "exam": "Uchunguzi wa miguu kila kliniki",
        "hba1c": "Udhibiti wa HbA1c uimarishwe (lengo < 7%)",
        "crp": "Ufuatiliaji wa CRP - uvimbe umegunduliwa",
        "kidney": "Tathmini ya figo inapendekezwa",
        "nutrition": "Tathmini ya lishe inapendekezwa (albumini iko chini)",
        "esr": "VS imepanda - tafuta maambukizi au uvimbe",
        "neuropathy": "Ugonjwa wa neva umegunduliwa - viatu vya matibabu vinapendekezwa",
        "pvd": "Ugonjwa wa mishipa - echo-Doppler inapendekezwa",
        "hygiene": "Usafi wa miguu kila siku na viatu vinavyofaa",
    },
    "tsh": {
        "urgent": "Kuya kwa muganga wa makasa mu lubilu kusungidibua",
        "exam": "Kutala makasa ku dimeki dionso",
        "hba1c": "Dimeki dia HbA1c difwane kukoleshiba (tshisumi < 7%)",
        "crp": "Kulama CRP - ditoka dia mubidi dimoneka",
        "kidney": "Dimeki dia mifigo disungidibua",
        "nutrition": "Dimeki dia bidia disungidibua (albumine idi panshi)",
        "esr": "VS ipite - kukeba maladi anyi ditoka",
        "neuropathy": "Maladi a misisa amoneka - bisabatu bia minganga bisungidibua",
        "pvd": "Maladi a mitshima ya mashi - echo-Doppler yisungidibua",
        "hygiene": "Bupupu bua makasa dituku ne dituku ne bisabatu bimpe",
    },
    "kg": {
        "urgent": "Kwenda na nganga ya makulu na nswalu yitumama",
        "exam": "Kutala makulu na kimeki yonso",
        "hba1c": "Kimeki ya HbA1c yifweni kukindama (nsuka < 7%)",
        "crp": "Kulanda CRP - nitu yitumuki yimonika",
        "kidney": "Kimeki ya mfigo yitumama",
        "nutrition": "Kimeki ya bilei yitumama (albumine yikitidi)",
        "esr": "VS yimatidi - sosa maladi to nitu yitumuki",
        "neuropathy": "Maladi ya misisa yimonika - bisabatu bya banganga bitumama",
        "pvd": "Maladi ya nzila ya menga - echo-Doppler yitumama",
        "hygiene": "Bupeto bwa makulu lumbu na lumbu ye bisabatu bya mbote",
    },
}


def predict_foot_risk(data: dict, lang: str = "fr") -> dict:
    score = 0.0

    # HbA1c (max 20 points) - glycemic control
    hba1c = data.get("hba1c", 5.0)
    if hba1c >= 9.0:
        score += 20
    elif hba1c >= 7.5:
        score += 14
    elif hba1c >= 6.5:
        score += 8
    else:
        score += 2

    # CRP (max 15 points) - inflammation
    crp = data.get("crp", 0.0)
    if crp >= 10:
        score += 15
    elif crp >= 3:
        score += 10
    elif crp >= 1:
        score += 5

    # Creatinine (max 15 points) - kidney function
    creatinine = data.get("creatinine", 0.8)
    if creatinine >= 2.0:
        score += 15
    elif creatinine >= 1.3:
        score += 10
    elif creatinine >= 1.0:
        score += 5

    # Diabetes duration (max 15 points)
    duration = data.get("diabetes_duration_years", 0)
    if duration >= 20:
        score += 15
    elif duration >= 10:
        score += 10
    elif duration >= 5:
        score += 5

    # Albumin (max 10 points) - low = worse (nutritional/inflammatory)
    albumin = data.get("albumin", 4.0)
    if albumin < 2.5:
        score += 10
    elif albumin < 3.5:
        score += 6
    else:
        score += 1

    # ESR (max 10 points) - sedimentation rate
    esr = data.get("esr", 10)
    if esr >= 40:
        score += 10
    elif esr >= 20:
        score += 6
    else:
        score += 1

    # Age (max 10 points)
    age = data.get("age", 30)
    if age >= 70:
        score += 10
    elif age >= 60:
        score += 7
    elif age >= 50:
        score += 4

    # Sodium (max 5 points) - hyponatremia
    sodium = data.get("sodium", 140)
    if sodium < 130:
        score += 5
    elif sodium < 135:
        score += 3

    # Boolean risk factors (bonus)
    if data.get("has_neuropathy", False):
        score += 5
    if data.get("has_pvd", False):
        score += 5
    if data.get("has_hypertension", False):
        score += 3

    # Clamp to 0-100
    score = min(max(round(score), 0), 100)

    # Determine risk level
    labels = RISK_LABELS.get(lang, RISK_LABELS["fr"])
    if score <= 30:
        risk_level = "low"
    elif score <= 60:
        risk_level = "moderate"
    else:
        risk_level = "high"
    risk_label = labels[risk_level]

    recommendations = _generate_recommendations(data, score, risk_level, lang)

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "shap_values": None,  # No SHAP in rule-based mode
        "recommendations": recommendations,
        "model_version": "rule_based_v1",
        "fallback": False,
    }


def _generate_recommendations(data: dict, score: float, risk_level: str, lang: str = "fr") -> list:
    r = RECS.get(lang, RECS["fr"])
    recs = []

    if score > 60:
        recs.append(r["urgent"])
    if score > 30:
        recs.append(r["exam"])

    if data.get("hba1c", 5) >= 7.5:
        recs.append(r["hba1c"])
    if data.get("crp", 0) >= 3:
        recs.append(r["crp"])
    if data.get("creatinine", 0.8) >= 1.3:
        recs.append(r["kidney"])
    if data.get("albumin", 4) < 3.5:
        recs.append(r["nutrition"])
    if data.get("esr", 10) >= 20:
        recs.append(r["esr"])
    if data.get("has_neuropathy", False):
        recs.append(r["neuropathy"])
    if data.get("has_pvd", False):
        recs.append(r["pvd"])

    recs.append(r["hygiene"])

    return recs
