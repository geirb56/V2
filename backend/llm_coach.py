"""
CardioCoach - Module LLM Coach (GPT-4o-mini)

Ce module gère l'enrichissement des textes coach via GPT-4o-mini.
Les données d'entraînement sont envoyées directement au LLM pour
générer des analyses personnalisées et motivantes.

Flux:
1. Réception des données d'entraînement
2. Envoi à GPT-4o-mini pour génération texte
3. Fallback templates Python si erreur
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
LLM_MODEL = "gpt-4.1-mini"
LLM_PROVIDER = "openai"
LLM_TIMEOUT = 10

# ============================================================
# PROMPTS SYSTÈME
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
# FONCTIONS D'ENRICHISSEMENT
# ============================================================

async def enrich_chat_response(
    user_message: str,
    context: Dict,
    conversation_history: List[Dict],
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit la réponse chat avec GPT-4o-mini.
    """
    context_str = _format_context(context)
    history_str = _format_history(conversation_history)
    
    prompt = f"""DONNÉES UTILISATEUR:
{context_str}

HISTORIQUE CONVERSATION:
{history_str}

QUESTION: {user_message}

Réponds en tant que coach running motivant."""

    return await _call_gpt(SYSTEM_PROMPT_COACH, prompt, user_id, "chat")


async def enrich_weekly_review(
    stats: Dict,
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit le bilan hebdomadaire avec GPT-4o-mini.
    """
    context_str = _format_context(stats)
    
    prompt = f"""STATS SEMAINE:
{context_str}

Génère un bilan hebdomadaire motivant et personnalisé basé sur ces données."""

    return await _call_gpt(SYSTEM_PROMPT_BILAN, prompt, user_id, "bilan")


async def enrich_workout_analysis(
    workout: Dict,
    user_id: str = "unknown"
) -> Tuple[Optional[str], bool, Dict]:
    """
    Enrichit l'analyse d'une séance avec GPT-4o-mini.
    """
    context_str = _format_context(workout)
    
    prompt = f"""DONNÉES SÉANCE:
{context_str}

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
        logger.warning("[LLM] Emergent LLM Key non configurée")
        return None, False, metadata
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"cardiocoach_{context_type}_{user_id}_{int(time.time())}"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        ).with_model(LLM_PROVIDER, LLM_MODEL)
        
        response = await asyncio.wait_for(
            chat.send_message(UserMessage(text=user_prompt)),
            timeout=LLM_TIMEOUT
        )
        
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        metadata["success"] = True
        
        response_text = _clean_response(str(response))
        
        if response_text:
            logger.info(f"[LLM] ✅ {context_type} enrichi en {elapsed:.2f}s")
            return response_text, True, metadata
        else:
            logger.warning(f"[LLM] Réponse vide pour {context_type}")
            return None, False, metadata
            
    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        logger.warning(f"[LLM] ⏱️ Timeout après {elapsed:.2f}s")
        return None, False, metadata
        
    except Exception as e:
        elapsed = time.time() - start_time
        metadata["duration_sec"] = round(elapsed, 2)
        logger.error(f"[LLM] ❌ Erreur: {e}")
        return None, False, metadata


def _format_context(data: Dict) -> str:
    """Formate les données en texte lisible pour le LLM"""
    lines = []
    for key, value in data.items():
        if value is not None and value != "" and value != {} and value != []:
            lines.append(f"- {key}: {value}")
    return "\n".join(lines) if lines else "Aucune donnée"


def _format_history(history: List[Dict]) -> str:
    """Formate l'historique de conversation"""
    if not history:
        return "Début de conversation"
    
    lines = []
    for msg in history[-4:]:
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
    
    if len(response) > 700:
        response = response[:700]
        last_period = max(response.rfind("."), response.rfind("!"), response.rfind("?"))
        if last_period > 400:
            response = response[:last_period + 1]
    
    return response.strip()


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "enrich_chat_response",
    "enrich_weekly_review", 
    "enrich_workout_analysis",
    "LLM_MODEL",
    "LLM_PROVIDER"
]
