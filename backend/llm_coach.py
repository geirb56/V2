"""
CardioCoach - Module LLM Serveur (Ollama)
# LLM serveur uniquement – pas d'exécution client-side

Ce module gère l'intégration avec Ollama pour générer des réponses naturelles
et conversationnelles. Tout est exécuté côté serveur, jamais sur le client mobile.

Fallback automatique: si Ollama n'est pas disponible, timeout ou erreur,
le système revient aux templates Python rule-based.
"""

import os
import time
import logging
from typing import Dict, List, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

# Configuration Ollama
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "phi3:mini")
OLLAMA_TIMEOUT = 15  # secondes max pour une réponse

# Prompt système pour le coach
SYSTEM_PROMPT = """Tu es CardioCoach, un coach running enthousiaste, motivant, positif et expert en plans d'entraînement.

PERSONNALITÉ:
- Tu parles naturellement en français courant, comme un ami coach
- Tu utilises des émoticônes avec parcimonie (1-2 max par message) 🏃💪
- Tu poses parfois des questions ouvertes pour continuer la conversation
- Tu es bienveillant, encourageant et fun - jamais de jugement négatif
- Tu gardes tes réponses concises (3-5 phrases max)

RÈGLES IMPORTANTES:
- Base tes conseils UNIQUEMENT sur les données Strava fournies
- Ne fabule pas, si tu n'as pas l'info, dis-le
- Encourage toujours, même si la performance n'est pas top
- Utilise le tutoiement
- Réponds directement à la question posée

DONNÉES UTILISATEUR DISPONIBLES:
{context_data}

HISTORIQUE DE LA CONVERSATION:
{conversation_history}
"""


async def check_ollama_available() -> bool:
    """Vérifie si Ollama est disponible et répond"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{OLLAMA_HOST}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


async def generate_llm_response(
    user_message: str,
    context: Dict,
    conversation_history: List[Dict],
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool]:
    """
    Génère une réponse via Ollama LLM.
    
    # LLM serveur uniquement – pas d'exécution client-side
    
    Args:
        user_message: Question de l'utilisateur
        context: Données RAG (workouts, stats, etc.)
        conversation_history: Historique des échanges récents
        user_id: ID utilisateur pour les logs
        
    Returns:
        Tuple[response_text, success_flag]
        - Si success=True: response contient la réponse LLM
        - Si success=False: response est None, utiliser le fallback templates
    """
    start_time = time.time()
    
    # Vérifier si Ollama est disponible
    if not await check_ollama_available():
        logger.warning(f"[LLM] Ollama non disponible sur {OLLAMA_HOST}")
        return None, False
    
    # Construire le contexte utilisateur pour le prompt
    context_data = _build_context_string(context)
    history_str = _build_history_string(conversation_history)
    
    # Construire le prompt complet
    system = SYSTEM_PROMPT.format(
        context_data=context_data,
        conversation_history=history_str
    )
    
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_message}
                    ],
                    "stream": False,
                    "options": {
                        "num_ctx": 2048,  # Context window
                        "num_predict": 256,  # Max tokens réponse
                        "temperature": 0.7,  # Créativité modérée
                        "top_p": 0.9,
                    }
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                llm_response = data.get("message", {}).get("content", "")
                
                elapsed = time.time() - start_time
                logger.info(f"[LLM] Réponse générée par {OLLAMA_MODEL} en {elapsed:.2f}s pour user {user_id}")
                
                # Nettoyer la réponse
                llm_response = _clean_response(llm_response)
                
                if llm_response:
                    return llm_response, True
                else:
                    logger.warning("[LLM] Réponse vide du modèle")
                    return None, False
            else:
                logger.error(f"[LLM] Erreur Ollama: {response.status_code} - {response.text}")
                return None, False
                
    except httpx.TimeoutException:
        elapsed = time.time() - start_time
        logger.warning(f"[LLM] Timeout après {elapsed:.2f}s pour user {user_id}")
        return None, False
    except Exception as e:
        logger.error(f"[LLM] Erreur: {e}")
        return None, False


def _build_context_string(context: Dict) -> str:
    """Construit une description humanisée du contexte utilisateur"""
    parts = []
    
    # Stats de la semaine
    km_semaine = context.get("km_semaine", 0)
    nb_seances = context.get("nb_seances", 0)
    allure = context.get("allure", "N/A")
    cadence = context.get("cadence", 0)
    
    if km_semaine > 0:
        parts.append(f"- Cette semaine: {km_semaine} km en {nb_seances} séance(s)")
    if allure != "N/A":
        parts.append(f"- Allure moyenne: {allure}/km")
    if cadence > 0:
        parts.append(f"- Cadence: {cadence} spm")
    
    # Zones cardiaques
    zones = context.get("zones", {})
    if zones:
        z1z2 = zones.get("z1", 0) + zones.get("z2", 0)
        z4z5 = zones.get("z4", 0) + zones.get("z5", 0)
        parts.append(f"- Répartition zones: {z1z2}% endurance, {z4z5}% intensité")
    
    # Dernière séance
    recent = context.get("recent_workouts", [])
    if recent:
        last = recent[0]
        parts.append(f"- Dernière sortie: {last.get('name', 'Run')} - {last.get('distance_km', 0)} km")
    
    # Ratio charge/récup
    ratio = context.get("ratio", 1.0)
    if ratio > 1.3:
        parts.append("- ⚠️ Charge élevée, récupération recommandée")
    elif ratio < 0.8:
        parts.append("- Charge légère, marge pour augmenter")
    
    # Tips RAG récupérés
    if context.get("rag_tips"):
        parts.append(f"- Conseils pertinents: {', '.join(context['rag_tips'][:2])}")
    
    return "\n".join(parts) if parts else "Données utilisateur non disponibles"


def _build_history_string(history: List[Dict]) -> str:
    """Construit l'historique de conversation pour le contexte"""
    if not history:
        return "Début de conversation"
    
    # Garder les 4 derniers échanges max
    recent_history = history[-4:]
    lines = []
    
    for msg in recent_history:
        role = "Utilisateur" if msg.get("role") == "user" else "Coach"
        content = msg.get("content", "")[:150]  # Tronquer si trop long
        lines.append(f"{role}: {content}")
    
    return "\n".join(lines)


def _clean_response(response: str) -> str:
    """Nettoie la réponse LLM"""
    if not response:
        return ""
    
    # Supprimer les balises markdown excessives
    response = response.strip()
    
    # Supprimer les répétitions du prompt système
    if "CardioCoach" in response[:50] and "coach running" in response[:100].lower():
        # Le modèle a répété le prompt, extraire la vraie réponse
        lines = response.split("\n")
        response = "\n".join(lines[-3:]) if len(lines) > 3 else response
    
    # Limiter la longueur
    if len(response) > 500:
        # Couper au dernier point
        response = response[:500]
        last_period = response.rfind(".")
        if last_period > 200:
            response = response[:last_period + 1]
    
    return response.strip()


# Export pour utilisation dans chat_engine.py
__all__ = ["generate_llm_response", "check_ollama_available", "OLLAMA_MODEL", "OLLAMA_HOST"]
