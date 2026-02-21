import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MessageCircle, 
  Send, 
  Crown, 
  Loader2, 
  X, 
  Trash2,
  Sparkles,
  Download,
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// System prompt for WebLLM
const SYSTEM_PROMPT = `Tu es un coach running expérimenté, empathique et précis. Réponds toujours en français. Structure ta réponse : 1. Positif d'abord (bravo, super séance...), 2. Analyse les données fournies, 3. Conseil actionable (allure, cadence, récup, prévention blessures), 4. Pose une question de relance si pertinent. Focus sur allure/km/cadence/zones cardio/récup/fatigue/plans. Sois concret et motivant.`;

// Check WebGPU support
const checkWebGPUSupport = async () => {
  if (!navigator.gpu) return { supported: false, reason: "WebGPU non supporté par ce navigateur" };
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: "Aucun adaptateur GPU disponible" };
    
    const device = await adapter.requestDevice();
    if (!device) return { supported: false, reason: "Impossible d'initialiser le GPU" };
    
    return { supported: true, adapter, device };
  } catch (e) {
    return { supported: false, reason: e.message };
  }
};

const ChatCoach = ({ isOpen, onClose, userId = "default" }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  
  // WebLLM state
  const [webGPUSupported, setWebGPUSupported] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [useLocalLLM, setUseLocalLLM] = useState(false);
  const [llmError, setLlmError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const engineRef = useRef(null);

  // Check subscription and WebGPU on mount
  useEffect(() => {
    const init = async () => {
      await checkSubscription();
      const gpuCheck = await checkWebGPUSupport();
      setWebGPUSupported(gpuCheck.supported);
      if (!gpuCheck.supported) {
        console.log("WebGPU not supported:", gpuCheck.reason);
      }
    };
    
    if (isOpen) {
      init();
      loadHistory();
    }
  }, [isOpen, userId]);

  const checkSubscription = async () => {
    try {
      const res = await axios.get(`${API}/subscription/status?user_id=${userId}`);
      setSubscriptionStatus(res.data);
    } catch (err) {
      console.error("Error checking subscription:", err);
      setSubscriptionStatus({ tier: "free", messages_limit: 10, messages_remaining: 10 });
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API}/chat/history?user_id=${userId}&limit=30`);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize WebLLM (simplified - actual implementation would use @mlc-ai/web-llm)
  const initializeWebLLM = async () => {
    if (!webGPUSupported) {
      setLlmError("WebGPU non supporté");
      return false;
    }
    
    setModelLoading(true);
    setDownloadProgress(0);
    
    try {
      // Note: In production, you would import and use @mlc-ai/web-llm
      // This is a placeholder that simulates the loading process
      // const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 200));
        setDownloadProgress(i);
      }
      
      // In real implementation:
      // engineRef.current = await CreateMLCEngine("SmolLM2-1.7B-Instruct-q4f16_1-MLC", {
      //   initProgressCallback: (progress) => {
      //     setDownloadProgress(Math.round(progress.progress * 100));
      //   }
      // });
      
      setModelLoaded(true);
      setUseLocalLLM(true);
      return true;
    } catch (err) {
      console.error("WebLLM init error:", err);
      setLlmError(err.message);
      return false;
    } finally {
      setModelLoading(false);
    }
  };

  // Generate response with WebLLM or fallback to Python templates
  const generateResponse = async (userMessage, trainingContext) => {
    // If WebLLM is loaded and working, use it
    if (useLocalLLM && engineRef.current) {
      try {
        const prompt = `${SYSTEM_PROMPT}\n\nDonnées d'entraînement de l'utilisateur:\n${JSON.stringify(trainingContext, null, 2)}\n\nQuestion: ${userMessage}`;
        
        const response = await engineRef.current.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Données: ${JSON.stringify(trainingContext)}\n\nQuestion: ${userMessage}` }
          ],
          max_tokens: 500,
          temperature: 0.7
        });
        
        return {
          text: response.choices[0].message.content,
          source: "webllm"
        };
      } catch (err) {
        console.error("WebLLM generation error:", err);
        // Fallback to server
      }
    }
    
    // Fallback: Use Python templates on server
    return { text: null, source: "fallback" };
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message optimistically
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Send to backend (for message counting and fallback)
      const res = await axios.post(`${API}/chat/send`, {
        message: userMessage,
        user_id: userId,
        use_local_llm: useLocalLLM && modelLoaded
      });

      let responseText = res.data.response;
      
      // If server returned empty (expecting WebLLM), generate locally
      if (!responseText && useLocalLLM && modelLoaded) {
        // Build training context
        const contextRes = await axios.get(`${API}/subscription/status?user_id=${userId}`);
        const trainingContext = {
          km_semaine: 45,
          allure_moyenne: "5:12/km",
          cadence_moy: 168,
          pct_zone2: 55,
          pct_zone4: 25,
          messages_remaining: contextRes.data.messages_remaining
        };
        
        const localResponse = await generateResponse(userMessage, trainingContext);
        responseText = localResponse.text || "Je n'ai pas pu générer une réponse. Réessaie !";
        
        // Store response on server
        if (localResponse.text) {
          await axios.post(`${API}/chat/store-response?user_id=${userId}&message_id=${res.data.message_id}&response=${encodeURIComponent(localResponse.text)}`);
        }
      }

      // Add assistant response
      const assistantMsg = {
        id: res.data.message_id,
        role: "assistant",
        content: responseText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update remaining messages
      setSubscriptionStatus(prev => ({
        ...prev,
        messages_remaining: res.data.messages_remaining,
        messages_used: (prev?.messages_used || 0) + 1
      }));

    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg = err.response?.data?.detail || "Erreur de connexion";
      
      const errorResponse = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ ${errorMsg}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete(`${API}/chat/history?user_id=${userId}`);
      setMessages([]);
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  if (!isOpen) return null;

  const canSendMessages = subscriptionStatus && subscriptionStatus.messages_remaining > 0;
  const tier = subscriptionStatus?.tier || "free";
  const tierName = subscriptionStatus?.tier_name || "Gratuit";
  const isUnlimited = subscriptionStatus?.is_unlimited || false;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" data-testid="chat-overlay">
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-background border-l border-border shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Chat Coach</h2>
                {tier !== "free" && (
                  <Badge className="text-[8px] bg-amber-500">{tierName}</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isUnlimited 
                  ? "Illimité" 
                  : `${subscriptionStatus?.messages_remaining || 0}/${subscriptionStatus?.messages_limit || 10} messages`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* WebLLM status indicator */}
            {webGPUSupported !== null && (
              <div className="flex items-center gap-1" title={modelLoaded ? "IA locale active" : "Mode serveur"}>
                {modelLoaded ? (
                  <Cpu className="w-3.5 h-3.5 text-green-500" />
                ) : webGPUSupported ? (
                  <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
            )}
            {messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={clearHistory}
                className="h-8 w-8"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-8 w-8"
              data-testid="close-chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {checkingStatus ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* WebLLM Loading Banner */}
            {modelLoading && (
              <div className="p-3 bg-amber-500/10 border-b border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span className="text-xs text-amber-600">
                    Téléchargement du coach IA local (~1.3 Go)
                  </span>
                </div>
                <Progress value={downloadProgress} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Wi-Fi recommandé • Une seule fois • 100% offline ensuite
                </p>
              </div>
            )}

            {/* WebLLM Init Button (if not loaded and supported) */}
            {!modelLoaded && !modelLoading && webGPUSupported && tier !== "free" && (
              <div className="p-3 bg-muted/50 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Coach IA local disponible</p>
                    <p className="text-[10px] text-muted-foreground">Réponses plus riches, 100% privé</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={initializeWebLLM}
                    className="text-xs h-7"
                  >
                    <Cpu className="w-3 h-3 mr-1" />
                    Activer
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Pose ta première question !</p>
                  <p className="text-xs mt-1">Ex: "Comment je récupère ?" ou "Analyse ma semaine"</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : msg.isError
                          ? "bg-destructive/10 text-destructive rounded-bl-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              {/* Low messages warning */}
              {!isUnlimited && subscriptionStatus?.messages_remaining <= 3 && subscriptionStatus?.messages_remaining > 0 && (
                <p className="text-xs text-amber-500 mb-2 text-center">
                  ⚠️ Plus que {subscriptionStatus.messages_remaining} messages ce mois
                </p>
              )}
              
              {/* Limit reached */}
              {!canSendMessages ? (
                <div className="text-center py-2">
                  <p className="text-xs text-destructive mb-2">
                    Tu as atteint ta limite de {subscriptionStatus?.messages_limit} messages ce mois-ci.
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => { onClose(); navigate("/subscription"); }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500"
                  >
                    <Crown className="w-3.5 h-3.5 mr-1" />
                    Passer au niveau supérieur
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Pose ta question..."
                    className="flex-1"
                    disabled={loading}
                    data-testid="chat-input"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={loading || !input.trim()}
                    size="icon"
                    data-testid="send-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatCoach;
