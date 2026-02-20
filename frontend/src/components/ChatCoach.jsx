import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  Crown, 
  Loader2, 
  X, 
  Trash2,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ChatCoach = ({ isOpen, onClose, userId = "default" }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const messagesEndRef = useRef(null);

  // Check premium status on mount
  useEffect(() => {
    const checkPremium = async () => {
      try {
        const res = await axios.get(`${API}/premium/status?user_id=${userId}`);
        setPremiumStatus(res.data);
      } catch (err) {
        console.error("Error checking premium:", err);
        setPremiumStatus({ is_premium: false });
      } finally {
        setCheckingPremium(false);
      }
    };
    
    if (isOpen) {
      checkPremium();
      loadHistory();
    }
  }, [isOpen, userId]);

  // Load chat history
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
      const res = await axios.post(`${API}/chat/send`, {
        message: userMessage,
        user_id: userId
      });

      // Add assistant response
      const assistantMsg = {
        id: res.data.message_id,
        role: "assistant",
        content: res.data.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update remaining messages
      setPremiumStatus(prev => ({
        ...prev,
        messages_remaining: res.data.messages_remaining,
        messages_used: (prev?.messages_used || 0) + 1
      }));

    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg = err.response?.data?.detail || "Erreur de connexion";
      
      // Show error message
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

  const handleSubscribe = async () => {
    try {
      const res = await axios.post(`${API}/premium/checkout`, {
        origin_url: window.location.origin
      }, {
        params: { user_id: userId }
      });
      
      // Redirect to Stripe checkout
      window.location.href = res.data.checkout_url;
    } catch (err) {
      console.error("Error creating checkout:", err);
    }
  };

  if (!isOpen) return null;

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
              <h2 className="font-semibold text-sm">Chat Coach</h2>
              <p className="text-[10px] text-muted-foreground">
                {premiumStatus?.is_premium 
                  ? `${premiumStatus.messages_remaining} messages restants`
                  : "Premium requis"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && premiumStatus?.is_premium && (
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
        {checkingPremium ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !premiumStatus?.is_premium ? (
          // Premium upsell
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Chat Coach Premium</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
              Pose tes questions à ton coach personnel. Analyse de tes données, conseils personnalisés, plan d'entraînement.
            </p>
            <ul className="text-xs text-muted-foreground mb-6 space-y-1">
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-amber-500" />
                30 messages/mois
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Réponses personnalisées
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Analyse de tes données
              </li>
            </ul>
            <Button 
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              data-testid="subscribe-btn"
            >
              <Crown className="w-4 h-4 mr-2" />
              S'abonner • 4.99€/mois
            </Button>
          </div>
        ) : (
          // Chat interface
          <>
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
              {premiumStatus.messages_remaining <= 5 && premiumStatus.messages_remaining > 0 && (
                <p className="text-xs text-amber-500 mb-2 text-center">
                  ⚠️ Plus que {premiumStatus.messages_remaining} messages ce mois
                </p>
              )}
              {premiumStatus.messages_remaining === 0 ? (
                <p className="text-xs text-destructive text-center py-2">
                  Limite mensuelle atteinte. Renouvellement le mois prochain !
                </p>
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
