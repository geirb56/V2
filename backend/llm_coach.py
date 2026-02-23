"""
CardioCoach - Module LLM Emergent (GPT-4o-mini)
# LLM serveur uniquement – pas d'exécution client-side

Ce module gère l'intégration avec Emergent Universal LLM Key pour générer 
des réponses naturelles et conversationnelles via GPT-4o-mini.

Fallback automatique: si l'appel LLM échoue (crédits épuisés, timeout, erreur),
le système revient aux templates Python rule-based.
"""

import os
import time
import logging
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configuration Emergent LLM
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LLM_MODEL = "gpt-4.1-mini"  # GPT-4o-mini equivalent
LLM_PROVIDER = "openai"
LLM_TIMEOUT = 15  # secondes max pour une réponse

# Prompt système pour le coach (identique à Ollama)
SYSTEM_PROMPT = """Tu es CardioCoach, un coach running enthousiaste, motivant, positif et expert en plans d'entraînement.

PERSONNALITÉ:
- Tu parles naturellement en français courant, comme un ami coach
- Tu utilises des émoticônes avec parcimonie (1-2 max par message) 🏃💪
- Tu poses parfois des questions ouvertes pour continuer la conversation
- Tu es bienveillant, encourageant et fun - jamais de jugement négatif
- Tu gardes tes réponses concises (3-5 phrases max)

RÈGLES IMPORTANTES:
- Base tes conseils UNIQUEMENT sur les données Strava fournies ci-dessous
- Ne fabule pas, si tu n'as pas l'info, dis-le
- Encourage toujours, même si la performance n'est pas top
- Utilise le tutoiement
- Réponds directement à la question posée

DONNÉES UTILISATEUR (Strava):
{context_data}

HISTORIQUE DE LA CONVERSATION:
{conversation_history}
"""


async def check_llm_available() -> bool:
    """Vérifie si la clé Emergent LLM est configurée"""
    return bool(EMERGENT_LLM_KEY) and EMERGENT_LLM_KEY.startswith("sk-emergent")


async def generate_llm_response(
    user_message: str,
    context: Dict,
    conversation_history: List[Dict],
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, dict]:
    """
    Génère une réponse via Emergent LLM (GPT-4o-mini).
    
    # LLM serveur uniquement – pas d'exécution client-side
    
    Args:
        user_message: Question de l'utilisateur
        context: Données RAG (workouts, stats, etc.)
        conversation_history: Historique des échanges récents
        user_id: ID utilisateur pour les logs
        
    Returns:
        Tuple[response_text, success_flag, metadata]
        - Si success=True: response contient la réponse LLM
        - Si success=False: response est None, utiliser le fallback templates
        - metadata: infos sur le temps de génération, tokens, etc.
    """
    start_time = time.time()
    metadata = {
        "model": LLM_MODEL,
        "provider": LLM_PROVIDER,
        "duration_sec": 0,
        "success": False
    }
    
    # Vérifier si la clé est disponible
    if not await check_llm_available():
        logger.warning(f"[LLM] Emergent LLM Key non configurée")
        return None, False, metadata
    
    # Construire le contexte utilisateur pour le prompt
    context_data = _build_context_string(context)
    history_str = _build_history_string(conversation_history)
    
    # Construire le prompt système complet
    system = SYSTEM_PROMPT.format(
        context_data=context_data,
        conversation_history=history_str
    )
    
    try:
        # Import Emergent LLM
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Créer une session unique pour cet utilisateur
        session_id = f"cardiocoach_{user_id}_{int(time.time())}"
        
        # Initialiser le chat avec GPT-4o-mini
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system
        ).with_model(LLM_PROVIDER, LLM_MODEL)
        
        # Créer le message utilisateur
        user_msg = UserMessage(text=user_message)
        
        # Envoyer et obtenir la réponse
        import asyncio
        response = await asyncio.wait_for(
            chat.send_message(user_msg),
            timeout=LLM_TIMEOUT
        )
        
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        metadata["success"] = True
        
        # Nettoyer la réponse
        llm_response = _clean_response(str(response))
        
        if llm_response:
            logger.info(f"[LLM] ✅ Réponse générée par {LLM_MODEL} en {elapsed:.2f}s pour user {user_id}")
            return llm_response, True, metadata
        else:
            logger.warning("[LLM] Réponse vide du modèle")
            return None, False, metadata
            
    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        logger.warning(f"[LLM] ⏱️ Timeout après {elapsed:.2f}s pour user {user_id}")
        return None, False, metadata
        
    except Exception as e:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        error_msg = str(e)
        
        # Vérifier si c'est un problème de crédits
        if "credit" in error_msg.lower() or "balance" in error_msg.lower():
            logger.error(f"[LLM] 💳 Crédits insuffisants pour user {user_id}")
        else:
            logger.error(f"[LLM] ❌ Erreur: {error_msg}")
        
        return None, False, metadata


def _build_context_string(context: Dict) -> str:
    """Construit une description humanisée du contexte utilisateur pour le RAG"""
    parts = []
    
    # Stats de la semaine
    km_semaine = context.get("km_semaine", 0)
    nb_seances = context.get("nb_seances", 0)
    allure = context.get("allure", "N/A")
    cadence = context.get("cadence", 0)
    
    if km_semaine > 0:
        parts.append(f"• Cette semaine: {km_semaine} km en {nb_seances} séance(s)")
    if allure != "N/A":
        parts.append(f"• Allure moyenne récente: {allure}/km")
    if cadence > 0:
        parts.append(f"• Cadence moyenne: {cadence} spm")
    
    # Zones cardiaques
    zones = context.get("zones", {})
    if zones:
        z1z2 = zones.get("z1", 0) + zones.get("z2", 0)
        z3 = zones.get("z3", 0)
        z4z5 = zones.get("z4", 0) + zones.get("z5", 0)
        parts.append(f"• Répartition zones: {z1z2}% endurance (Z1-Z2), {z3}% tempo (Z3), {z4z5}% intensité (Z4-Z5)")
    
    # Dernières séances
    recent = context.get("recent_workouts", [])
    if recent:
        parts.append("• Dernières sorties:")
        for w in recent[:3]:
            name = w.get('name', 'Run')
            dist = w.get('distance_km', 0)
            dur = w.get('duration_min', 0)
            if dist > 0:
                parts.append(f"  - {name}: {dist} km en {dur} min")
    
    # Ratio charge/récup
    ratio = context.get("ratio", 1.0)
    if ratio > 1.3:
        parts.append("• ⚠️ Charge élevée cette semaine vs la précédente")
    elif ratio < 0.8:
        parts.append("• Charge légère cette semaine, marge pour augmenter")
    else:
        parts.append("• Charge équilibrée cette semaine")
    
    # Objectif course
    if context.get("objectif_nom"):
        jours = context.get("jours_course", "?")
        parts.append(f"• Objectif: {context['objectif_nom']} dans {jours} jours")
    
    # Split analysis si disponible
    if context.get("split_analysis"):
        sa = context["split_analysis"]
        if sa.get("fastest_km"):
            parts.append(f"• Dernière séance - Km le + rapide: Km{sa['fastest_km']}, Km le + lent: Km{sa.get('slowest_km', '?')}")
    
    return "\n".join(parts) if parts else "Pas encore de données d'entraînement disponibles."


def _build_history_string(history: List[Dict]) -> str:
    """Construit l'historique de conversation pour le contexte LLM"""
    if not history:
        return "Début de conversation"
    
    # Garder les 4-5 derniers échanges max
    recent_history = history[-5:]
    lines = []
    
    for msg in recent_history:
        role = "Utilisateur" if msg.get("role") == "user" else "Coach"
        content = msg.get("content", "")[:200]  # Tronquer si trop long
        lines.append(f"{role}: {content}")
    
    return "\n".join(lines)


def _clean_response(response: str) -> str:
    """Nettoie la réponse LLM"""
    if not response:
        return ""
    
    response = response.strip()
    
    # Supprimer les guillemets en début/fin si présents
    if response.startswith('"') and response.endswith('"'):
        response = response[1:-1]
    
    # Limiter la longueur raisonnable
    if len(response) > 600:
        # Couper au dernier point ou emoji
        response = response[:600]
        last_period = max(response.rfind("."), response.rfind("!"), response.rfind("?"))
        if last_period > 300:
            response = response[:last_period + 1]
    
    return response.strip()


# Fonction pour obtenir les infos du modèle utilisé
def get_llm_info() -> dict:
    """Retourne les informations sur le modèle LLM configuré"""
    return {
        "provider": LLM_PROVIDER,
        "model": LLM_MODEL,
        "key_configured": bool(EMERGENT_LLM_KEY),
        "timeout_sec": LLM_TIMEOUT
    }


# Export pour utilisation dans server.py
__all__ = [
    "generate_llm_response", 
    "check_llm_available", 
    "get_llm_info",
    "LLM_MODEL", 
    "LLM_PROVIDER"
]
