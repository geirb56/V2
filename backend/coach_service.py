"""
CardioCoach - Service de Coaching Cascade avec Cache et Métriques

Stratégie:
1. Vérifier cache (0ms)
2. Analyse déterministe (instantanée) via rag_engine
3. Enrichissement LLM (~500ms) si disponible
4. Stocker en cache + métriques

Usage:
    from coach_service import analyze_workout, weekly_review, chat_response, get_metrics
"""

import hashlib
import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple

from llm_coach import (
    enrich_chat_response,
    enrich_weekly_review,
    enrich_workout_analysis,
    LLM_MODEL
)
from chat_engine import generate_chat_response as generate_template_response

logger = logging.getLogger(__name__)


# ============================================================
# METRICS
# ============================================================

@dataclass
class CoachMetrics:
    """Métriques du service de coaching"""
    # Compteurs
    llm_success: int = 0
    llm_fallback: int = 0
    cache_hits: int = 0
    total_requests: int = 0
    
    # Latence (moyenne mobile)
    avg_latency_ms: float = 0.0
    llm_avg_latency_ms: float = 0.0
    cache_avg_latency_ms: float = 0.0
    
    # Par type
    workout_requests: int = 0
    weekly_requests: int = 0
    chat_requests: int = 0


metrics = CoachMetrics()


def get_metrics() -> dict:
    """Retourne les métriques actuelles"""
    data = asdict(metrics)
    # Calculer le taux de succès LLM
    total_llm = metrics.llm_success + metrics.llm_fallback
    data["llm_success_rate"] = round(metrics.llm_success / total_llm * 100, 1) if total_llm > 0 else 0
    data["cache_hit_rate"] = round(metrics.cache_hits / metrics.total_requests * 100, 1) if metrics.total_requests > 0 else 0
    return data


def reset_metrics() -> dict:
    """Reset les métriques"""
    global metrics
    old = get_metrics()
    metrics = CoachMetrics()
    return old


def _update_latency(latency_ms: float, is_llm: bool = False, is_cache: bool = False) -> None:
    """Met à jour les moyennes mobiles de latence (exponential moving average)"""
    alpha = 0.1  # Facteur de lissage
    metrics.avg_latency_ms = (metrics.avg_latency_ms * (1 - alpha)) + (latency_ms * alpha)
    
    if is_llm:
        metrics.llm_avg_latency_ms = (metrics.llm_avg_latency_ms * (1 - alpha)) + (latency_ms * alpha)
    if is_cache:
        metrics.cache_avg_latency_ms = (metrics.cache_avg_latency_ms * (1 - alpha)) + (latency_ms * alpha)


# ============================================================
# CACHE CONFIGURATION
# ============================================================

CACHE_TTL_SECONDS = 3600  # 1 heure
MAX_CACHE_SIZE = 500

_workout_cache: Dict[str, Tuple[dict, float]] = {}
_weekly_cache: Dict[str, Tuple[dict, float]] = {}


def _cache_key(data: dict, prefix: str = "") -> str:
    """Génère une clé de cache basée sur les données."""
    key_parts = [prefix]
    for field in ["id", "distance_km", "duration_minutes", "avg_heart_rate", "type"]:
        key_parts.append(str(data.get(field, "")))
    return hashlib.md5("_".join(key_parts).encode()).hexdigest()


def _is_cache_valid(timestamp: float) -> bool:
    return (time.time() - timestamp) < CACHE_TTL_SECONDS


def _cleanup_cache(cache: dict) -> None:
    if len(cache) > MAX_CACHE_SIZE:
        expired_keys = [k for k, (_, ts) in cache.items() if not _is_cache_valid(ts)]
        for k in expired_keys:
            del cache[k]
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
    """Analyse séance avec cache + métriques + stratégie cascade."""
    start = time.time()
    metrics.total_requests += 1
    metrics.workout_requests += 1
    
    # 1. Vérifier cache
    cache_key = _cache_key(workout, "workout")
    if cache_key in _workout_cache:
        cached_result, timestamp = _workout_cache[cache_key]
        if _is_cache_valid(timestamp):
            metrics.cache_hits += 1
            latency = (time.time() - start) * 1000
            _update_latency(latency, is_cache=True)
            logger.debug(f"[Cache] Hit workout {cache_key[:8]} ({latency:.1f}ms)")
            return cached_result["summary"], cached_result["used_llm"]
    
    # 2. Analyse déterministe
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
            metrics.llm_success += 1
            latency = (time.time() - start) * 1000
            _update_latency(latency, is_llm=True)
            logger.info(f"[Coach] ✅ Séance LLM ({latency:.0f}ms)")
            
            _workout_cache[cache_key] = ({"summary": enriched, "used_llm": True}, time.time())
            _cleanup_cache(_workout_cache)
            return enriched, True
            
    except Exception as e:
        logger.warning(f"[Coach] Séance fallback: {e}")
    
    # Fallback
    metrics.llm_fallback += 1
    latency = (time.time() - start) * 1000
    _update_latency(latency)
    
    _workout_cache[cache_key] = ({"summary": deterministic_summary, "used_llm": False}, time.time())
    _cleanup_cache(_workout_cache)
    return deterministic_summary, False


async def weekly_review(
    rag_result: dict,
    user_id: str = "default"
) -> Tuple[str, bool]:
    """Bilan hebdomadaire avec cache + métriques + stratégie cascade."""
    start = time.time()
    metrics.total_requests += 1
    metrics.weekly_requests += 1
    
    # 1. Clé cache
    m = rag_result.get("metrics", {})
    cache_data = {
        "id": f"weekly_{m.get('nb_seances', 0)}_{m.get('km_total', 0)}",
        "distance_km": m.get("km_total", 0),
        "duration_minutes": m.get("duree_totale", 0),
    }
    cache_key = _cache_key(cache_data, "weekly")
    
    # 2. Vérifier cache
    if cache_key in _weekly_cache:
        cached_result, timestamp = _weekly_cache[cache_key]
        if _is_cache_valid(timestamp):
            metrics.cache_hits += 1
            latency = (time.time() - start) * 1000
            _update_latency(latency, is_cache=True)
            logger.debug(f"[Cache] Hit weekly {cache_key[:8]} ({latency:.1f}ms)")
            return cached_result["summary"], cached_result["used_llm"]
    
    # 3. Bilan déterministe
    deterministic_summary = rag_result.get("summary", "")
    
    # 4. Enrichissement LLM
    try:
        weekly_stats = {
            "km_semaine": m.get("km_total", 0),
            "nb_seances": m.get("nb_seances", 0),
            "allure_moy": m.get("allure_moyenne", "N/A"),
            "cadence_moy": m.get("cadence_moyenne", 0),
            "zones": m.get("zones", {}),
            "ratio_charge": m.get("ratio", 1.0),
            "points_forts": rag_result.get("points_forts", []),
            "points_ameliorer": rag_result.get("points_ameliorer", []),
            "tendance": rag_result.get("comparison", {}).get("evolution", "stable"),
        }
        
        enriched, success, meta = await enrich_weekly_review(
            stats=weekly_stats,
            user_id=user_id
        )
        
        if success and enriched:
            metrics.llm_success += 1
            latency = (time.time() - start) * 1000
            _update_latency(latency, is_llm=True)
            logger.info(f"[Coach] ✅ Bilan LLM ({latency:.0f}ms)")
            
            _weekly_cache[cache_key] = ({"summary": enriched, "used_llm": True}, time.time())
            _cleanup_cache(_weekly_cache)
            return enriched, True
            
    except Exception as e:
        logger.warning(f"[Coach] Bilan fallback: {e}")
    
    # Fallback
    metrics.llm_fallback += 1
    latency = (time.time() - start) * 1000
    _update_latency(latency)
    
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
    """Réponse chat avec métriques (pas de cache)."""
    start = time.time()
    metrics.total_requests += 1
    metrics.chat_requests += 1
    
    # 1. Essayer LLM
    try:
        response, success, meta = await enrich_chat_response(
            user_message=message,
            context=context,
            conversation_history=history,
            user_id=user_id
        )
        
        if success and response:
            metrics.llm_success += 1
            latency = (time.time() - start) * 1000
            _update_latency(latency, is_llm=True)
            logger.info(f"[Coach] ✅ Chat LLM ({latency:.0f}ms)")
            return response, True, meta
            
    except Exception as e:
        logger.warning(f"[Coach] Chat fallback: {e}")
    
    # 2. Fallback templates
    metrics.llm_fallback += 1
    
    try:
        result = await generate_template_response(
            message=message,
            user_id=user_id,
            workouts=workouts or [],
            user_goal=user_goal
        )
        
        latency = (time.time() - start) * 1000
        _update_latency(latency)
        
        if isinstance(result, dict):
            return result.get("response", ""), False, {"suggestions": result.get("suggestions", [])}
        return result, False, {}
        
    except Exception as e:
        logger.error(f"[Coach] Erreur fallback: {e}")
        return "Désolé, je n'ai pas pu traiter ta demande.", False, {}


def clear_cache() -> dict:
    """Vide les caches."""
    global _workout_cache, _weekly_cache
    result = {"cleared_workout": len(_workout_cache), "cleared_weekly": len(_weekly_cache)}
    _workout_cache = {}
    _weekly_cache = {}
    return result


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
    "get_cache_stats",
    "get_metrics",
    "reset_metrics"
]
