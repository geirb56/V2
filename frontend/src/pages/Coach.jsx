import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Fetch recent workouts for context
    const fetchWorkouts = async () => {
      try {
        const res = await axios.get(`${API}/workouts`);
        setWorkouts(res.data);
      } catch (error) {
        console.error("Failed to fetch workouts:", error);
      }
    };
    fetchWorkouts();
  }, []);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const buildContext = () => {
    if (workouts.length === 0) return "";
    
    const recentWorkouts = workouts.slice(0, 5).map(w => ({
      type: w.type,
      name: w.name,
      date: w.date,
      distance_km: w.distance_km,
      duration_minutes: w.duration_minutes,
      avg_heart_rate: w.avg_heart_rate,
      avg_pace_min_km: w.avg_pace_min_km,
      avg_speed_kmh: w.avg_speed_kmh,
      effort_zone_distribution: w.effort_zone_distribution
    }));

    return `Recent training data (last 5 workouts):\n${JSON.stringify(recentWorkouts, null, 2)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(`${API}/coach/analyze`, {
        message: userMessage,
        context: buildContext()
      });

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.response 
      }]);
    } catch (error) {
      console.error("Coach error:", error);
      toast.error("Analysis failed. Check connection.");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Unable to process request." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] md:h-screen" data-testid="coach-page">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-border">
        <h1 className="font-heading text-2xl md:text-3xl uppercase tracking-tight font-bold mb-1">
          Coach
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Performance Analysis
        </p>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-6 md:p-8">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="max-w-md">
              <p className="font-mono text-sm text-muted-foreground mb-4">
                Ask about your training data. Zone distribution. Pace patterns. Recovery metrics.
              </p>
              <div className="space-y-2">
                <SuggestionButton 
                  onClick={() => setInput("Analyze my recent training load and effort distribution.")}
                  text="Analyze training load"
                />
                <SuggestionButton 
                  onClick={() => setInput("What patterns do you see in my heart rate data?")}
                  text="Heart rate patterns"
                />
                <SuggestionButton 
                  onClick={() => setInput("How is my pace consistency across recent runs?")}
                  text="Pace consistency"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`animate-in ${msg.role === "user" ? "text-right" : ""}`}
                data-testid={`message-${idx}`}
              >
                {msg.role === "user" ? (
                  <div className="inline-block text-left max-w-[85%] md:max-w-[70%]">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      You
                    </p>
                    <Card className="bg-muted border-border">
                      <CardContent className="p-4">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="max-w-[85%] md:max-w-[70%]">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                      CardioCoach
                    </p>
                    <div className="coach-message">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="animate-in">
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                  CardioCoach
                </p>
                <div className="coach-message">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 md:p-6 border-t border-border bg-background">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Textarea
            data-testid="coach-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your training..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-muted border-transparent focus:border-primary rounded-none font-mono text-sm"
            disabled={loading}
          />
          <Button
            type="submit"
            data-testid="coach-submit"
            disabled={!input.trim() || loading}
            className="bg-primary text-white hover:bg-primary/90 rounded-none uppercase font-bold tracking-wider text-xs h-11 px-6"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SuggestionButton({ onClick, text }) {
  return (
    <button
      onClick={onClick}
      data-testid={`suggestion-${text.toLowerCase().replace(/\s+/g, "-")}`}
      className="block w-full p-3 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground transition-colors"
    >
      {text}
    </button>
  );
}
