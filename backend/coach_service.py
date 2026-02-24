"""
CardioCoach - Service de Coaching Cascade avec Cache

Stratégie:
1. Vérifier cache (0ms)
2. Analyse déterministe (instantanée) via rag_engine
3. Enrichissement LLM (~500ms) si disponible
4. Stocker en cache

Usage:
    from coach_service import analyze_workout, weekly_review, chat_response
"""

import hashlib
import logging
import time
from typing import Dict, List, Tuple
from functools import lru_cache

from llm_coach import (
    enrich_chat_response,
    enrich_weekly_review,
    enrich_workout_analysis,
    LLM_MODEL
)
from chat_engine import generate_chat_response as generate_template_response

logger = logging.getLogger(__name__)

# ============================================================
# CACHE CONFIGURATION
# ============================================================

CACHE_TTL_SECONDS = 3600  # 1 heure
MAX_CACHE_SIZE = 500

# Caches en mémoire
_workout_cache: Dict[str, Tuple[dict, float]] = {}
_weekly_cache: Dict[str, Tuple[dict, float]] = {}


def _cache_key(data: dict, prefix: str = "") -> str:
    """Génère une clé de cache basée sur les données."""
    key_parts = [prefix]
    
    # Extraire les champs pertinents pour le hash
    for field in ["id", "distance_km", "duration_minutes", "avg_heart_rate", "type"]:
        key_parts.append(str(data.get(field, "")))
    
    return hashlib.md5("_".join(key_parts).encode()).hexdigest()


def _is_cache_valid(timestamp: float) -> bool:
    """Vérifie si l'entrée cache est encore valide."""
    return (time.time() - timestamp) < CACHE_TTL_SECONDS


def _cleanup_cache(cache: dict) -> None:
    """Nettoie les entrées expirées du cache."""
    if len(cache) > MAX_CACHE_SIZE:
        expired_keys = [k for k, (_, ts) in cache.items() if not _is_cache_valid(ts)]
        for k in expired_keys:
            del cache[k]
        
        # Si toujours trop grand, supprimer les plus anciens
        if len(cache) > MAX_CACHE_SIZE:
            sorted_items = sorted(cache.items(), key=lambda x: x[1][1])
            for k, _ in sorted_items[:len(cache) - MAX_CACHE_SIZE]:
                del cache[k]


# ============================================================
# FONCTIONS PRINCIPALES
# ============================================================

async def analyze_workout(
    workout: dict,
    rag_result: dict,
    user_id: str = "default"
) -> Tuple[str, bool]:
    """
    Analyse séance avec cache + stratégie cascade.
    
    Returns:
        (summary_text, used_llm)
    """
    # 1. Vérifier cache
    cache_key = _cache_key(workout, "workout")
    if cache_key in _workout_cache:
        cached_result, timestamp = _workout_cache[cache_key]
        if _is_cache_valid(timestamp):
            logger.debug(f"[Cache] Hit workout {cache_key[:8]}")
            return cached_result["summary"], cached_result["used_llm"]
    
    # 2. Analyse déterministe (déjà calculée par rag_engine)
    deterministic_summary = rag_result.get("summary", "")
    
    # 3. Enrichissement LLM
    try:
        workout_stats = {
            "distance_km": workout.get("distance_km", 0),
            "duree_min": workout.get("duration_minutes", 0),
            "allure": rag_result.get("pace_str", "N/A"),
            "fc_moy": workout.get("avg_heart_rate"),
            "fc_max": workout.get("max_heart_rate"),
            "denivele": workout.get("elevation_gain_m"),
            "type": workout.get("type"),
            "zones": workout.get("effort_zone_distribution", {}),
            "splits": rag_result.get("splits_analysis", {}),
            "comparison": rag_result.get("comparison", {}).get("progression", ""),
            "points_forts": rag_result.get("points_forts", []),
            "points_ameliorer": rag_result.get("points_ameliorer", []),
        }
        
        enriched, success, meta = await enrich_workout_analysis(
            workout=workout_stats,
            user_id=user_id
        )
        
        if success and enriched:
            logger.info(f"[Coach] ✅ Séance enrichie LLM en {meta.get('duration_sec', 0)}s")
            # Stocker en cache
            _workout_cache[cache_key] = ({"summary": enriched, "used_llm": True}, time.time())
            _cleanup_cache(_workout_cache)
            return enriched, True
            
    except Exception as e:
        logger.warning(f"[Coach] Séance fallback déterministe: {e}")
    
    # Stocker fallback en cache
    _workout_cache[cache_key] = ({"summary": deterministic_summary, "used_llm": False}, time.time())
    _cleanup_cache(_workout_cache)
    return deterministic_summary, False


async def weekly_review(
    rag_result: dict,
    user_id: str = "default"
) -> Tuple[str, bool]:
    """
    Bilan hebdomadaire avec cache + stratégie cascade.
    
    Returns:
        (summary_text, used_llm)
    """
    # 1. Générer clé cache basée sur métriques
    metrics = rag_result.get("metrics", {})
    cache_data = {
        "id": f"weekly_{metrics.get('nb_seances', 0)}_{metrics.get('km_total', 0)}",
        "distance_km": metrics.get("km_total", 0),
        "duration_minutes": metrics.get("duree_totale", 0),
    }
    cache_key = _cache_key(cache_data, "weekly")
    
    # 2. Vérifier cache
    if cache_key in _weekly_cache:
        cached_result, timestamp = _weekly_cache[cache_key]
        if _is_cache_valid(timestamp):
            logger.debug(f"[Cache] Hit weekly {cache_key[:8]}")
            return cached_result["summary"], cached_result["used_llm"]
    
    # 3. Bilan déterministe
    deterministic_summary = rag_result.get("summary", "")
    
    # 4. Enrichissement LLM
    try:
        weekly_stats = {
            "km_semaine": metrics.get("km_total", 0),
            "nb_seances": metrics.get("nb_seances", 0),
            "allure_moy": metrics.get("allure_moyenne", "N/A"),
            "cadence_moy": metrics.get("cadence_moyenne", 0),
            "zones": metrics.get("zones", {}),
            "ratio_charge": metrics.get("ratio", 1.0),
            "points_forts": rag_result.get("points_forts", []),
            "points_ameliorer": rag_result.get("points_ameliorer", []),
            "tendance": rag_result.get("comparison", {}).get("evolution", "stable"),
        }
        
        enriched, success, meta = await enrich_weekly_review(
            stats=weekly_stats,
            user_id=user_id
        )
        
        if success and enriched:
            logger.info(f"[Coach] ✅ Bilan enrichi LLM en {meta.get('duration_sec', 0)}s")
            _weekly_cache[cache_key] = ({"summary": enriched, "used_llm": True}, time.time())
            _cleanup_cache(_weekly_cache)
            return enriched, True
            
    except Exception as e:
        logger.warning(f"[Coach] Bilan fallback déterministe: {e}")
    
    _weekly_cache[cache_key] = ({"summary": deterministic_summary, "used_llm": False}, time.time())
    _cleanup_cache(_weekly_cache)
    return deterministic_summary, False


async def chat_response(
    message: str,
    context: dict,
    history: List[dict],
    user_id: str,
    workouts: List[dict] = None,
    user_goal: dict = None
) -> Tuple[str, bool, dict]:
    """
    Réponse chat avec stratégie cascade (pas de cache - réponses uniques).
    
    Returns:
        (response_text, used_llm, metadata)
    """
    metadata = {}
    
    # 1. Essayer LLM d'abord
    try:
        response, success, meta = await enrich_chat_response(
            user_message=message,
            context=context,
            conversation_history=history,
            user_id=user_id
        )
        
        if success and response:
            logger.info(f"[Coach] ✅ Chat LLM ({LLM_MODEL}) en {meta.get('duration_sec', 0)}s")
            return response, True, meta
            
    except Exception as e:
        logger.warning(f"[Coach] Chat fallback templates: {e}")
    
    # 2. Fallback templates
    logger.info("[Coach] Chat fallback déterministe")
    
    try:
        result = await generate_template_response(
            message=message,
            user_id=user_id,
            workouts=workouts or [],
            user_goal=user_goal
        )
        
        if isinstance(result, dict):
            return result.get("response", ""), False, {"suggestions": result.get("suggestions", [])}
        return result, False, {}
        
    except Exception as e:
        logger.error(f"[Coach] Erreur fallback templates: {e}")
        return "Désolé, je n'ai pas pu traiter ta demande. Réessaie.", False, {}


def clear_cache() -> dict:
    """Vide les caches (utile pour debug/tests)."""
    global _workout_cache, _weekly_cache
    workout_count = len(_workout_cache)
    weekly_count = len(_weekly_cache)
    _workout_cache = {}
    _weekly_cache = {}
    return {"cleared_workout": workout_count, "cleared_weekly": weekly_count}


def get_cache_stats() -> dict:
    """Retourne les statistiques du cache."""
    return {
        "workout_cache_size": len(_workout_cache),
        "weekly_cache_size": len(_weekly_cache),
        "max_size": MAX_CACHE_SIZE,
        "ttl_seconds": CACHE_TTL_SECONDS
    }


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "analyze_workout",
    "weekly_review", 
    "chat_response",
    "clear_cache",
    "get_cache_stats"
]
