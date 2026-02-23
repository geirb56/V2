"""
CardioCoach - Module LLM Enrichissement (GPT-4o-mini)
# LLM serveur uniquement – données anonymisées uniquement

Ce module gère l'enrichissement des textes coach via GPT-4o-mini.
IMPORTANT: Seules les données CALCULÉES et ANONYMISÉES sont envoyées à OpenAI.
Aucune donnée brute Strava n'est transmise (conformité ToS).

Flux:
1. Calculs stats 100% Python local (km, allure, zones, etc.)
2. Construction JSON anonymisé
3. Envoi à GPT-4o-mini pour génération texte
4. Fallback templates Python si erreur
"""

import os
import time
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LLM_MODEL = "gpt-4.1-mini"  # GPT-4o-mini
LLM_PROVIDER = "openai"
LLM_TIMEOUT = 10  # secondes max

# ============================================================
# PROMPTS SYSTÈME FIXES
# ============================================================

SYSTEM_PROMPT_COACH = """Tu es un coach running expérimenté, empathique et précis. 
Réponds toujours en français courant avec contractions ('t'as', 'c'est', 'j'te').

Structure de réponse :
1. Positif d'abord (félicite, encourage)
2. Analyse claire et simple des données (explique les chiffres sans jargon)
3. Conseil actionable (allure, cadence, récup, renforcement)
4. Question de relance si pertinent

Focus : allure/km, cadence, zones cardio, récupération, fatigue, plans.
Sois concret, motivant et bienveillant. Max 4-5 phrases."""

SYSTEM_PROMPT_BILAN = """Tu es un coach running qui fait le bilan hebdomadaire.
Réponds en français courant avec contractions ('t'as', 'c'est').

Structure du bilan :
1. Intro positive (félicite la régularité ou l'effort)
2. Analyse des chiffres clés (explique simplement)
3. Points forts (2 max)
4. Point à améliorer (1 max, formulé positivement)
5. Conseil pour la semaine prochaine
6. Question de relance motivante

Sois encourageant même si les stats sont moyennes. Max 6-8 phrases."""

SYSTEM_PROMPT_SEANCE = """Tu es un coach running qui analyse une séance.
Réponds en français courant avec contractions ('t'as', 'c'est').

Structure :
1. Réaction positive sur l'effort accompli
2. Analyse simple des données (allure, FC, régularité)
3. Point fort de la séance
4. Conseil pour la prochaine sortie
5. Relance motivante (optionnel)

Sois concret et encourageant. Max 4-5 phrases."""


# ============================================================
# FONCTIONS D'ENRICHISSEMENT GPT
# ============================================================

async def enrich_chat_response(
    user_message: str,
    anonymized_context: Dict,
    conversation_history: List[Dict],
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit la réponse chat avec GPT-4o-mini.
    
    Args:
        user_message: Question de l'utilisateur
        anonymized_context: Données ANONYMISÉES (pas de raw Strava)
        conversation_history: Historique des échanges
        user_id: ID utilisateur pour logs
        
    Returns:
        (response_text, success, metadata)
    """
    context_json = _build_anonymized_json(anonymized_context)
    history_str = _build_history_string(conversation_history)
    
    prompt = f"""DONNÉES UTILISATEUR (anonymisées):
{context_json}

HISTORIQUE CONVERSATION:
{history_str}

QUESTION: {user_message}

Réponds en tant que coach running motivant."""

    return await _call_gpt(SYSTEM_PROMPT_COACH, prompt, user_id, "chat")


async def enrich_weekly_review(
    anonymized_stats: Dict,
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit le bilan hebdomadaire avec GPT-4o-mini.
    
    Args:
        anonymized_stats: Stats ANONYMISÉES de la semaine
        user_id: ID utilisateur pour logs
        
    Returns:
        (bilan_text, success, metadata)
    """
    context_json = _build_anonymized_json(anonymized_stats)
    
    prompt = f"""STATS SEMAINE (anonymisées):
{context_json}

Génère un bilan hebdomadaire motivant et personnalisé basé sur ces données."""

    return await _call_gpt(SYSTEM_PROMPT_BILAN, prompt, user_id, "bilan")


async def enrich_workout_analysis(
    anonymized_workout: Dict,
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit l'analyse d'une séance avec GPT-4o-mini.
    
    Args:
        anonymized_workout: Données ANONYMISÉES de la séance
        user_id: ID utilisateur pour logs
        
    Returns:
        (analysis_text, success, metadata)
    """
    context_json = _build_anonymized_json(anonymized_workout)
    
    prompt = f"""DONNÉES SÉANCE (anonymisées):
{context_json}

Analyse cette séance en tant que coach running bienveillant."""

    return await _call_gpt(SYSTEM_PROMPT_SEANCE, prompt, user_id, "seance")


# ============================================================
# FONCTIONS INTERNES
# ============================================================

async def _call_gpt(
    system_prompt: str,
    user_prompt: str,
    user_id: str,
    context_type: str
) -> Tuple[Optional[str], bool, Dict]:
    """Appel GPT-4o-mini via Emergent LLM Key"""
    
    start_time = time.time()
    metadata = {
        "model": LLM_MODEL,
        "provider": LLM_PROVIDER,
        "context_type": context_type,
        "duration_sec": 0,
        "success": False
    }
    
    if not EMERGENT_LLM_KEY or not EMERGENT_LLM_KEY.startswith("sk-emergent"):
        logger.warning(f"[LLM] Emergent LLM Key non configurée")
        return None, False, metadata
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"cardiocoach_{context_type}_{user_id}_{int(time.time())}"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        ).with_model(LLM_PROVIDER, LLM_MODEL)
        
        user_msg = UserMessage(text=user_prompt)
        
        response = await asyncio.wait_for(
            chat.send_message(user_msg),
            timeout=LLM_TIMEOUT
        )
        
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        metadata["success"] = True
        
        response_text = _clean_response(str(response))
        
        if response_text:
            logger.info(f"[LLM] ✅ {context_type} enrichi par {LLM_MODEL} en {elapsed:.2f}s pour user {user_id}")
            return response_text, True, metadata
        else:
            logger.warning(f"[LLM] Réponse vide pour {context_type}")
            return None, False, metadata
            
    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        logger.warning(f"[LLM] ⏱️ Timeout {context_type} après {elapsed:.2f}s")
        return None, False, metadata
        
    except Exception as e:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        logger.error(f"[LLM] ❌ Erreur {context_type}: {e}")
        return None, False, metadata


def _build_anonymized_json(data: Dict) -> str:
    """
    Construit un JSON ANONYMISÉ des données calculées.
    IMPORTANT: Aucune donnée brute Strava ici, seulement des stats agrégées.
    """
    # Filtrer pour ne garder que les données anonymisées/calculées
    safe_keys = {
        # Stats semaine
        "km_semaine", "nb_seances", "duree_totale_min", "allure_moy",
        "cadence_moy", "fc_moyenne", "denivele_total",
        # Zones (pourcentages uniquement)
        "pct_zone1", "pct_zone2", "pct_zone3", "pct_zone4", "pct_zone5",
        "pct_endurance", "pct_intensite",
        # Charge et récup
        "ratio_charge", "tendance", "fatigue", "recuperation",
        # Séance individuelle (anonymisée)
        "distance_km", "duree_min", "allure", "cadence", "fc_max", "fc_moy",
        "denivele", "type_seance", "regularity_score",
        # Splits (anonymisés)
        "nb_splits", "fastest_km", "slowest_km", "pace_drop", "negative_split",
        # Objectifs
        "objectif", "jours_restants",
        # Divers
        "points_forts", "points_ameliorer", "conseil", "niveau"
    }
    
    filtered = {}
    for key, value in data.items():
        if key in safe_keys:
            filtered[key] = value
    
    # Formatter en texte lisible
    lines = []
    for key, value in filtered.items():
        if value is not None and value != "":
            lines.append(f"- {key}: {value}")
    
    return "\n".join(lines) if lines else "Données insuffisantes"


def _build_history_string(history: List[Dict]) -> str:
    """Construit l'historique de conversation (anonymisé)"""
    if not history:
        return "Début de conversation"
    
    recent = history[-4:]
    lines = []
    for msg in recent:
        role = "User" if msg.get("role") == "user" else "Coach"
        content = msg.get("content", "")[:150]
        lines.append(f"{role}: {content}")
    
    return "\n".join(lines)


def _clean_response(response: str) -> str:
    """Nettoie la réponse GPT"""
    if not response:
        return ""
    
    response = response.strip()
    
    if response.startswith('"') and response.endswith('"'):
        response = response[1:-1]
    
    # Limiter la longueur
    if len(response) > 700:
        response = response[:700]
        last_period = max(response.rfind("."), response.rfind("!"), response.rfind("?"))
        if last_period > 400:
            response = response[:last_period + 1]
    
    return response.strip()


# ============================================================
# HELPERS POUR ANONYMISATION
# ============================================================

def anonymize_weekly_stats(context: Dict) -> Dict:
    """
    Prépare les stats hebdo ANONYMISÉES pour GPT.
    Transforme les données calculées en format safe.
    """
    zones = context.get("zones", {})
    
    return {
        "km_semaine": context.get("km_semaine", 0),
        "nb_seances": context.get("nb_seances", 0),
        "allure_moy": context.get("allure", "N/A"),
        "cadence_moy": context.get("cadence", 0),
        "pct_endurance": zones.get("z1", 0) + zones.get("z2", 0),
        "pct_intensite": zones.get("z4", 0) + zones.get("z5", 0),
        "ratio_charge": context.get("ratio", 1.0),
        "objectif": context.get("objectif_nom", ""),
        "jours_restants": context.get("jours_course"),
        "tendance": "stable",
        "points_forts": context.get("points_forts", []),
        "points_ameliorer": context.get("points_ameliorer", []),
    }


def anonymize_workout_stats(workout: Dict) -> Dict:
    """
    Prépare les stats d'une séance ANONYMISÉES pour GPT.
    Aucune donnée identifiante (nom, date, GPS, etc.)
    """
    split_analysis = workout.get("split_analysis", {})
    hr_analysis = workout.get("hr_analysis", {})
    
    return {
        "distance_km": workout.get("distance_km", 0),
        "duree_min": workout.get("duration_min", 0),
        "allure": workout.get("average_pace_str", "N/A"),
        "cadence": workout.get("average_cadence", 0),
        "fc_moy": hr_analysis.get("avg_hr", 0),
        "fc_max": hr_analysis.get("max_hr", 0),
        "denivele": workout.get("elevation_gain", 0),
        "type_seance": _detect_workout_type(workout),
        "nb_splits": split_analysis.get("total_splits", 0),
        "fastest_km": split_analysis.get("fastest_km"),
        "slowest_km": split_analysis.get("slowest_km"),
        "pace_drop": split_analysis.get("pace_drop", 0),
        "negative_split": split_analysis.get("negative_split", False),
        "regularity_score": split_analysis.get("consistency_score", 0),
    }


def _detect_workout_type(workout: Dict) -> str:
    """Détecte le type de séance basé sur les données"""
    distance = workout.get("distance_km", 0)
    zones = workout.get("effort_zone_distribution", {})
    z4z5 = zones.get("z4", 0) + zones.get("z5", 0)
    
    if distance >= 15:
        return "sortie_longue"
    elif z4z5 >= 30:
        return "fractionne_intensif"
    elif z4z5 >= 15:
        return "tempo"
    else:
        return "endurance_fondamentale"


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "enrich_chat_response",
    "enrich_weekly_review", 
    "enrich_workout_analysis",
    "anonymize_weekly_stats",
    "anonymize_workout_stats",
    "LLM_MODEL",
    "LLM_PROVIDER"
]
