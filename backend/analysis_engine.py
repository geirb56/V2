"""
CardioCoach Analysis Engine
100% Backend, Deterministic, No LLM Dependencies
Strava API Compliant - No data leaves the infrastructure
"""

import random
from typing import Dict, List, Optional
from datetime import datetime, timezone


# ============================================================
# TEMPLATES DE TEXTES - FRANÇAIS
# ============================================================

# --- RÉSUMÉ GLOBAL (1 phrase max) ---
SUMMARY_TEMPLATES = {
    "easy_session": [
        "Séance facile bien exécutée, idéale pour la récupération active.",
        "Sortie tranquille qui fait du bien au corps sans l'épuiser.",
        "Bon travail en endurance fondamentale, c'est la base.",
    ],
    "moderate_session": [
        "Séance équilibrée avec un effort bien dosé.",
        "Sortie correcte, ni trop facile ni trop dure.",
        "Entraînement modéré qui construit la forme sans fatiguer.",
    ],
    "hard_session": [
        "Séance intense qui sollicite bien l'organisme.",
        "Effort soutenu, le corps a travaillé dur aujourd'hui.",
        "Sortie exigeante, tu as poussé les limites.",
    ],
    "very_hard_session": [
        "Séance très intense, proche de tes limites.",
        "Gros effort fourni, le corps va avoir besoin de repos.",
        "Entraînement à haute intensité, bien joué mais récupère bien.",
    ],
    "long_session": [
        "Belle sortie longue pour développer l'endurance.",
        "Volume conséquent aujourd'hui, bon travail de fond.",
        "Séance longue réussie, ça construit la caisse.",
    ],
    "short_session": [
        "Séance courte mais utile pour maintenir le rythme.",
        "Sortie brève, parfois c'est suffisant.",
        "Petit entraînement de maintien, c'est bien aussi.",
    ],
}

# --- EXÉCUTION (ce qui a été fait) ---
EXECUTION_TEMPLATES = {
    "run": [
        "{distance_km} km en {duree} à {allure_moy}/km de moyenne.",
        "Course de {distance_km} km, durée {duree}, allure {allure_moy}/km.",
        "{distance_km} kilomètres parcourus en {duree} ({allure_moy}/km).",
    ],
    "run_with_hr": [
        "{distance_km} km en {duree} à {allure_moy}/km, FC moyenne {fc_moy} bpm.",
        "Course de {distance_km} km ({duree}) à {allure_moy}/km avec une FC de {fc_moy} bpm.",
    ],
    "run_with_zones": [
        "{distance_km} km en {duree}. Répartition : {pct_z1_z2}% facile, {pct_z3}% modéré, {pct_z4_z5}% intense.",
        "Course de {distance_km} km avec {pct_z4_z5}% du temps en zones hautes (Z4-Z5).",
    ],
    "cycle": [
        "{distance_km} km en {duree} à {vitesse_moy} km/h de moyenne.",
        "Sortie vélo de {distance_km} km, durée {duree}, vitesse {vitesse_moy} km/h.",
    ],
}

# --- CE QUE ÇA SIGNIFIE (lecture coach) ---
MEANING_TEMPLATES = {
    "mostly_easy": [
        "L'effort est resté confortable, c'est parfait pour construire la base aérobie.",
        "Tu as travaillé en zone facile, le corps récupère tout en s'entraînant.",
        "Séance orientée endurance fondamentale, exactement ce qu'il faut pour progresser sur la durée.",
    ],
    "mostly_moderate": [
        "L'intensité était correcte, ni trop ni pas assez.",
        "Tu as maintenu un effort modéré, bon pour la progression.",
        "Zone d'effort intermédiaire, le corps travaille sans s'épuiser.",
    ],
    "mostly_hard": [
        "L'effort était soutenu, tu as bien sollicité le système cardio.",
        "Beaucoup de temps en zone haute, c'est un stimulus fort pour progresser.",
        "Séance exigeante qui va créer des adaptations si tu récupères bien.",
    ],
    "mixed_intensity": [
        "L'effort était varié, mélangeant zones faciles et intenses.",
        "Séance avec des variations d'intensité, bon pour la polyvalence.",
        "Tu as alterné les allures, c'est intéressant pour le corps.",
    ],
    "high_cadence": [
        "Ta cadence était bonne ({cadence} ppm), signe d'une foulée efficace.",
        "Cadence élevée à {cadence} ppm, c'est positif pour l'économie de course.",
    ],
    "low_cadence": [
        "Ta cadence à {cadence} ppm est un peu basse, essaie de raccourcir la foulée.",
        "Cadence de {cadence} ppm : viser 170+ améliorerait ton efficacité.",
    ],
    "good_pace_consistency": [
        "L'allure était régulière, signe d'un bon contrôle de l'effort.",
        "Tu as bien géré ton rythme, c'est une qualité importante.",
    ],
    "variable_pace": [
        "L'allure a varié, peut-être dû au terrain ou à la fatigue.",
        "Rythme irrégulier, essaie de trouver une cadence plus stable.",
    ],
}

# --- RÉCUPÉRATION / ÉTAT DE FATIGUE ---
RECOVERY_TEMPLATES = {
    "needs_rest": [
        "Après cet effort, une journée de repos ou très facile demain serait idéale.",
        "Le corps a besoin de récupérer, privilégie le repos demain.",
        "Laisse le temps à l'organisme d'absorber cette séance avant de forcer à nouveau.",
    ],
    "light_recovery": [
        "Une sortie facile demain aidera à bien récupérer.",
        "Récupération active conseillée : footing très léger ou repos.",
        "Pas de grosse séance demain, le corps doit assimiler.",
    ],
    "ready_for_more": [
        "Tu peux enchaîner demain si tu te sens bien.",
        "L'effort était gérable, tu as de la marge pour continuer.",
        "Bonne gestion, tu peux repartir sans problème.",
    ],
    "well_recovered": [
        "Tu sembles bien récupéré, c'est le moment de pousser un peu.",
        "Le corps est frais, tu peux te permettre une séance plus intense.",
    ],
}

# --- CONSEIL CONCRET (OBLIGATOIRE) ---
ADVICE_TEMPLATES = {
    "add_easy_run": [
        "Ajoute une sortie facile de 30-40 min en zone 2 cette semaine.",
        "Prévois une course tranquille pour équilibrer l'intensité.",
        "Une sortie en endurance fondamentale compléterait bien ta semaine.",
    ],
    "add_intensity": [
        "Tu pourrais intégrer une séance plus rythmée cette semaine.",
        "Ajoute un peu d'intensité : quelques accélérations progressives par exemple.",
        "Une séance tempo ou fractionné court serait bénéfique.",
    ],
    "work_on_cadence": [
        "Travaille ta cadence : vise 170-180 pas/min sur tes sorties faciles.",
        "Essaie de raccourcir ta foulée pour augmenter la cadence.",
        "Focus sur les petits pas rapides plutôt que les grandes foulées.",
    ],
    "maintain_consistency": [
        "Continue comme ça, la régularité paie sur le long terme.",
        "Garde ce rythme d'entraînement, c'est la clé de la progression.",
        "Tu es sur la bonne voie, reste constant.",
    ],
    "reduce_intensity": [
        "Baisse un peu l'intensité générale, tu forces beaucoup.",
        "Moins de Z4-Z5, plus de Z2 pour éviter la fatigue chronique.",
        "Privilégie les sorties faciles cette semaine.",
    ],
    "increase_volume": [
        "Tu peux augmenter légèrement le volume si tu te sens bien.",
        "Ajoute 10-15% de kilomètres progressivement.",
        "Le corps est prêt pour un peu plus de charge.",
    ],
    "rest_more": [
        "Prends un jour de repos complet, ton corps en a besoin.",
        "La récupération fait partie de l'entraînement, repose-toi.",
        "N'hésite pas à lever le pied quelques jours.",
    ],
    "prepare_race": [
        "Continue la préparation, tu es sur la bonne trajectoire pour ton objectif.",
        "Maintiens le cap, l'objectif approche.",
        "Bon travail de fond pour ta course à venir.",
    ],
}

# --- BILAN HEBDOMADAIRE ---
WEEKLY_SUMMARY_TEMPLATES = {
    "good_week": [
        "Bonne semaine d'entraînement avec {nb_seances} séances et {volume_km} km.",
        "Semaine solide : {nb_seances} sorties pour un total de {volume_km} km.",
        "{nb_seances} séances cette semaine, {volume_km} km au compteur. Bien joué.",
    ],
    "light_week": [
        "Semaine légère avec {nb_seances} séance(s) et {volume_km} km.",
        "Volume réduit cette semaine : {volume_km} km sur {nb_seances} sortie(s).",
        "Semaine tranquille, {volume_km} km seulement mais c'est parfois nécessaire.",
    ],
    "heavy_week": [
        "Grosse semaine avec {volume_km} km sur {nb_seances} séances.",
        "Volume important : {nb_seances} sorties et {volume_km} km. Attention à la fatigue.",
        "Semaine chargée ({volume_km} km), le corps va demander du repos.",
    ],
    "consistent_week": [
        "Semaine régulière et bien équilibrée.",
        "Bon équilibre volume/intensité cette semaine.",
        "Entraînement cohérent, c'est ce qui fait progresser.",
    ],
    "intense_week": [
        "Semaine orientée intensité avec beaucoup de temps en zones hautes.",
        "L'intensité était élevée cette semaine, attention à ne pas accumuler.",
        "Beaucoup d'effort soutenu, pense à récupérer.",
    ],
}

WEEKLY_READING_TEMPLATES = {
    "balanced": [
        "La répartition effort facile/intense est bonne. Tu construis une base solide.",
        "Bon équilibre entre endurance et intensité cette semaine.",
        "L'entraînement est bien dosé, continue comme ça.",
    ],
    "too_intense": [
        "Beaucoup de temps en zones hautes ({pct_z4_z5}%). Ajoute plus de sorties faciles.",
        "L'intensité domine, le risque de fatigue augmente. Plus de Z2 nécessaire.",
        "Tu forces beaucoup, le corps a besoin de séances plus légères.",
    ],
    "too_easy": [
        "Principalement en zone facile. C'est bien pour la base, mais un peu d'intensité aiderait.",
        "Semaine tranquille, tu peux te permettre une séance plus rythmée.",
        "Beaucoup d'endurance fondamentale, parfait si c'est voulu.",
    ],
    "improving": [
        "La tendance est positive par rapport à la semaine dernière.",
        "Progression visible, tu es sur la bonne voie.",
        "Amélioration par rapport aux semaines précédentes.",
    ],
    "declining": [
        "Volume en baisse par rapport à la semaine dernière.",
        "Moins d'activité que d'habitude, peut-être nécessaire pour récupérer.",
        "Légère baisse de régime, écoute ton corps.",
    ],
}

WEEKLY_ADVICE_TEMPLATES = {
    "maintain": [
        "Continue sur ce rythme, c'est efficace.",
        "Garde cette dynamique pour la semaine prochaine.",
        "Pas de changement nécessaire, tu es bien.",
    ],
    "add_volume": [
        "Tu peux ajouter une sortie supplémentaire la semaine prochaine.",
        "Augmente légèrement le volume si tu te sens frais.",
        "Une sortie de plus ne ferait pas de mal.",
    ],
    "add_easy": [
        "Ajoute une ou deux sorties très faciles pour équilibrer.",
        "Plus de temps en zone 2 la semaine prochaine.",
        "Privilégie l'endurance fondamentale.",
    ],
    "add_intensity": [
        "Une séance plus intense serait bénéfique.",
        "Ajoute un peu de rythme : tempo ou fractionné.",
        "Le corps est prêt pour plus d'intensité.",
    ],
    "recover": [
        "Semaine de récupération conseillée.",
        "Baisse le volume et l'intensité quelques jours.",
        "Laisse le corps se reposer avant de repartir.",
    ],
}


# ============================================================
# FONCTIONS DE CALCUL DES MÉTRIQUES
# ============================================================

def calculate_intensity_level(zones: dict) -> str:
    """Determine intensity level from HR zones"""
    if not zones:
        return "moderate"
    
    z1_z2 = (zones.get("z1", 0) or 0) + (zones.get("z2", 0) or 0)
    z4_z5 = (zones.get("z4", 0) or 0) + (zones.get("z5", 0) or 0)
    
    if z4_z5 >= 40:
        return "very_hard"
    elif z4_z5 >= 25:
        return "hard"
    elif z1_z2 >= 70:
        return "easy"
    else:
        return "moderate"


def calculate_session_type(distance_km: float, duration_min: int, intensity: str) -> str:
    """Determine session type based on metrics"""
    if duration_min >= 90 or distance_km >= 15:
        return "long"
    elif duration_min <= 30 or distance_km <= 5:
        return "short"
    elif intensity in ["hard", "very_hard"]:
        return intensity
    elif intensity == "easy":
        return "easy"
    else:
        return "moderate"


def format_duration(minutes: int) -> str:
    """Format duration as Xh XXmin"""
    if not minutes:
        return "0min"
    hours = minutes // 60
    mins = minutes % 60
    if hours > 0:
        return f"{hours}h{mins:02d}"
    return f"{mins}min"


def format_pace(pace_min_km: float) -> str:
    """Format pace as X:XX/km"""
    if not pace_min_km:
        return "-"
    mins = int(pace_min_km)
    secs = int((pace_min_km - mins) * 60)
    return f"{mins}:{secs:02d}"


def get_random_template(templates: list) -> str:
    """Select a random template from a list"""
    return random.choice(templates)


# ============================================================
# GÉNÉRATEUR D'ANALYSE DE SÉANCE
# ============================================================

def generate_session_analysis(workout: dict, baseline: dict = None, language: str = "fr") -> dict:
    """
    Generate a complete session analysis without LLM
    Returns structured feedback following the mandatory format
    """
    
    # Extract workout data
    distance_km = workout.get("distance_km", 0)
    duration_min = workout.get("duration_minutes", 0)
    avg_pace = workout.get("avg_pace_min_km")
    avg_hr = workout.get("avg_heart_rate")
    zones = workout.get("effort_zone_distribution", {})
    cadence = workout.get("avg_cadence_spm")
    workout_type = workout.get("type", "run")
    
    # Calculate metrics
    intensity_level = calculate_intensity_level(zones)
    session_type = calculate_session_type(distance_km, duration_min, intensity_level)
    
    # Calculate zone percentages
    z1_z2 = (zones.get("z1", 0) or 0) + (zones.get("z2", 0) or 0)
    z3 = zones.get("z3", 0) or 0
    z4_z5 = (zones.get("z4", 0) or 0) + (zones.get("z5", 0) or 0)
    
    # Build placeholders
    placeholders = {
        "distance_km": round(distance_km, 1),
        "duree": format_duration(duration_min),
        "allure_moy": format_pace(avg_pace) if avg_pace else "-",
        "fc_moy": avg_hr or "-",
        "cadence": cadence or "-",
        "pct_z1_z2": round(z1_z2),
        "pct_z3": round(z3),
        "pct_z4_z5": round(z4_z5),
        "vitesse_moy": round(workout.get("avg_speed_kmh", 0), 1) if workout.get("avg_speed_kmh") else "-",
    }
    
    # 1. RÉSUMÉ GLOBAL
    summary_key = f"{session_type}_session" if f"{session_type}_session" in SUMMARY_TEMPLATES else "moderate_session"
    summary = get_random_template(SUMMARY_TEMPLATES.get(summary_key, SUMMARY_TEMPLATES["moderate_session"]))
    
    # 2. EXÉCUTION
    if workout_type == "run":
        if zones:
            execution_template = get_random_template(EXECUTION_TEMPLATES["run_with_zones"])
        elif avg_hr:
            execution_template = get_random_template(EXECUTION_TEMPLATES["run_with_hr"])
        else:
            execution_template = get_random_template(EXECUTION_TEMPLATES["run"])
    else:
        execution_template = get_random_template(EXECUTION_TEMPLATES.get("cycle", EXECUTION_TEMPLATES["run"]))
    
    execution = execution_template.format(**placeholders)
    
    # 3. CE QUE ÇA SIGNIFIE
    meaning_parts = []
    
    # Intensity meaning
    if z4_z5 >= 40:
        meaning_parts.append(get_random_template(MEANING_TEMPLATES["mostly_hard"]))
    elif z1_z2 >= 70:
        meaning_parts.append(get_random_template(MEANING_TEMPLATES["mostly_easy"]))
    elif z4_z5 >= 20 and z1_z2 >= 40:
        meaning_parts.append(get_random_template(MEANING_TEMPLATES["mixed_intensity"]))
    else:
        meaning_parts.append(get_random_template(MEANING_TEMPLATES["mostly_moderate"]))
    
    # Cadence meaning (for running)
    if workout_type == "run" and cadence:
        if cadence >= 170:
            meaning_parts.append(get_random_template(MEANING_TEMPLATES["high_cadence"]).format(**placeholders))
        elif cadence < 165:
            meaning_parts.append(get_random_template(MEANING_TEMPLATES["low_cadence"]).format(**placeholders))
    
    meaning = " ".join(meaning_parts)
    
    # 4. RÉCUPÉRATION
    if intensity_level == "very_hard" or (duration_min >= 90):
        recovery = get_random_template(RECOVERY_TEMPLATES["needs_rest"])
    elif intensity_level == "hard":
        recovery = get_random_template(RECOVERY_TEMPLATES["light_recovery"])
    else:
        recovery = get_random_template(RECOVERY_TEMPLATES["ready_for_more"])
    
    # 5. CONSEIL
    if intensity_level == "very_hard":
        advice = get_random_template(ADVICE_TEMPLATES["rest_more"])
    elif intensity_level == "hard" and z1_z2 < 30:
        advice = get_random_template(ADVICE_TEMPLATES["add_easy_run"])
    elif intensity_level == "easy" and z4_z5 < 10:
        advice = get_random_template(ADVICE_TEMPLATES["add_intensity"])
    elif cadence and cadence < 165:
        advice = get_random_template(ADVICE_TEMPLATES["work_on_cadence"])
    else:
        advice = get_random_template(ADVICE_TEMPLATES["maintain_consistency"])
    
    return {
        "summary": summary,
        "execution": execution,
        "meaning": meaning,
        "recovery": recovery,
        "advice": advice,
        "metrics": {
            "intensity_level": intensity_level,
            "session_type": session_type,
            "zones": {
                "easy": round(z1_z2),
                "moderate": round(z3),
                "hard": round(z4_z5)
            }
        }
    }


# ============================================================
# GÉNÉRATEUR DE BILAN HEBDOMADAIRE
# ============================================================

def generate_weekly_review(
    workouts: List[dict],
    previous_week_workouts: List[dict] = None,
    user_goal: dict = None,
    language: str = "fr"
) -> dict:
    """
    Generate a complete weekly review without LLM
    Returns structured feedback following the mandatory format
    """
    
    if not workouts:
        return {
            "summary": "Aucune séance cette semaine.",
            "execution": "Pas d'activité enregistrée.",
            "meaning": "Une semaine de repos complet, parfois nécessaire.",
            "recovery": "Tu es probablement bien reposé.",
            "advice": "Reprends doucement avec une sortie facile.",
            "metrics": {
                "total_sessions": 0,
                "total_km": 0,
                "total_duration_min": 0
            }
        }
    
    # Calculate weekly metrics
    nb_seances = len(workouts)
    volume_km = round(sum(w.get("distance_km", 0) for w in workouts), 1)
    total_duration = sum(w.get("duration_minutes", 0) for w in workouts)
    
    # Calculate average zones
    zone_totals = {"z1": 0, "z2": 0, "z3": 0, "z4": 0, "z5": 0}
    zone_count = 0
    total_cadence = 0
    cadence_count = 0
    
    for w in workouts:
        zones = w.get("effort_zone_distribution", {})
        if zones:
            for z in ["z1", "z2", "z3", "z4", "z5"]:
                zone_totals[z] += zones.get(z, 0) or 0
            zone_count += 1
        
        if w.get("avg_cadence_spm"):
            total_cadence += w["avg_cadence_spm"]
            cadence_count += 1
    
    avg_zones = {z: round(v / zone_count) if zone_count > 0 else 0 for z, v in zone_totals.items()}
    avg_cadence = round(total_cadence / cadence_count) if cadence_count > 0 else None
    
    z1_z2 = avg_zones["z1"] + avg_zones["z2"]
    z4_z5 = avg_zones["z4"] + avg_zones["z5"]
    
    # Compare to previous week
    prev_volume = sum(w.get("distance_km", 0) for w in previous_week_workouts) if previous_week_workouts else 0
    volume_change = round(((volume_km - prev_volume) / prev_volume * 100) if prev_volume > 0 else 0)
    
    # Build placeholders
    placeholders = {
        "nb_seances": nb_seances,
        "volume_km": volume_km,
        "duree_totale": format_duration(total_duration),
        "pct_z1_z2": round(z1_z2),
        "pct_z4_z5": round(z4_z5),
        "variation": f"{volume_change:+d}%" if volume_change != 0 else "stable",
        "cadence": avg_cadence or "-",
    }
    
    # Determine week type
    if volume_km < 15:
        week_type = "light"
    elif volume_km > 50:
        week_type = "heavy"
    elif z4_z5 >= 30:
        week_type = "intense"
    else:
        week_type = "good"
    
    # 1. RÉSUMÉ
    summary_key = f"{week_type}_week"
    summary = get_random_template(WEEKLY_SUMMARY_TEMPLATES.get(summary_key, WEEKLY_SUMMARY_TEMPLATES["good_week"]))
    summary = summary.format(**placeholders)
    
    # 2. EXÉCUTION
    execution = f"{nb_seances} séance(s) pour un total de {volume_km} km en {format_duration(total_duration)}."
    if volume_change != 0:
        direction = "hausse" if volume_change > 0 else "baisse"
        execution += f" Volume en {direction} de {abs(volume_change)}% vs semaine précédente."
    
    # 3. CE QUE ÇA SIGNIFIE
    if z4_z5 >= 35:
        meaning = get_random_template(WEEKLY_READING_TEMPLATES["too_intense"]).format(**placeholders)
    elif z1_z2 >= 80:
        meaning = get_random_template(WEEKLY_READING_TEMPLATES["too_easy"])
    elif volume_change >= 15:
        meaning = get_random_template(WEEKLY_READING_TEMPLATES["improving"])
    elif volume_change <= -15:
        meaning = get_random_template(WEEKLY_READING_TEMPLATES["declining"])
    else:
        meaning = get_random_template(WEEKLY_READING_TEMPLATES["balanced"])
    
    # 4. RÉCUPÉRATION
    if week_type == "heavy" or z4_z5 >= 35:
        recovery = get_random_template(RECOVERY_TEMPLATES["needs_rest"])
    elif week_type == "intense":
        recovery = get_random_template(RECOVERY_TEMPLATES["light_recovery"])
    else:
        recovery = get_random_template(RECOVERY_TEMPLATES["ready_for_more"])
    
    # 5. CONSEIL
    if week_type == "heavy":
        advice = get_random_template(WEEKLY_ADVICE_TEMPLATES["recover"])
    elif z4_z5 >= 35:
        advice = get_random_template(WEEKLY_ADVICE_TEMPLATES["add_easy"])
    elif z1_z2 >= 85 and z4_z5 < 10:
        advice = get_random_template(WEEKLY_ADVICE_TEMPLATES["add_intensity"])
    elif volume_km < 20:
        advice = get_random_template(WEEKLY_ADVICE_TEMPLATES["add_volume"])
    else:
        advice = get_random_template(WEEKLY_ADVICE_TEMPLATES["maintain"])
    
    # Add goal context if present
    if user_goal and user_goal.get("event_name"):
        days_until = None
        try:
            event_date = datetime.fromisoformat(user_goal["event_date"]).date()
            today = datetime.now(timezone.utc).date()
            days_until = (event_date - today).days
        except:
            pass
        
        if days_until and days_until > 0:
            advice += f" Objectif {user_goal['event_name']} dans {days_until} jours."
    
    return {
        "summary": summary,
        "execution": execution,
        "meaning": meaning,
        "recovery": recovery,
        "advice": advice,
        "metrics": {
            "total_sessions": nb_seances,
            "total_km": volume_km,
            "total_duration_min": total_duration,
            "avg_zones": avg_zones,
            "avg_cadence": avg_cadence,
            "volume_change_pct": volume_change
        },
        "signals": [
            {
                "key": "load",
                "status": "up" if volume_change > 15 else "down" if volume_change < -15 else "stable",
                "value": f"{volume_change:+d}%" if volume_change != 0 else "="
            },
            {
                "key": "intensity",
                "status": "hard" if z4_z5 >= 30 else "easy" if z1_z2 >= 75 else "balanced"
            },
            {
                "key": "consistency",
                "status": "high" if nb_seances >= 4 else "moderate" if nb_seances >= 2 else "low"
            }
        ]
    }


# ============================================================
# GÉNÉRATEUR D'INSIGHT DASHBOARD
# ============================================================

def generate_dashboard_insight(
    week_stats: dict,
    month_stats: dict,
    recovery_score: int = None,
    language: str = "fr"
) -> str:
    """
    Generate a single dashboard insight sentence without LLM
    """
    
    sessions = week_stats.get("sessions", 0)
    volume = week_stats.get("volume_km", 0)
    
    if sessions == 0:
        insights = [
            "Pas encore de séance cette semaine, c'est le moment de s'y mettre.",
            "Semaine vierge pour l'instant, une sortie facile serait parfaite.",
            "Aucune activité cette semaine, le corps est reposé.",
        ]
    elif sessions == 1:
        insights = [
            "Une séance cette semaine, bon début. Ajoute une sortie facile.",
            "Première sortie faite, continue sur cette lancée.",
            "C'est parti pour la semaine avec une séance au compteur.",
        ]
    elif volume > 40:
        insights = [
            "Belle charge cette semaine, pense à bien récupérer.",
            "Volume conséquent, le corps travaille dur.",
            "Grosse semaine en cours, écoute ton corps.",
        ]
    elif recovery_score and recovery_score < 50:
        insights = [
            "Fatigue accumulée, privilégie une sortie facile.",
            "Corps un peu fatigué, pas de forcing aujourd'hui.",
            "Récupération en cours, reste tranquille.",
        ]
    else:
        insights = [
            "Entraînement en cours, continue comme ça.",
            "Bonne dynamique cette semaine, garde le rythme.",
            "Tu avances bien, reste régulier.",
        ]
    
    return random.choice(insights)
