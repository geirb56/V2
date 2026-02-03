import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity, 
  Flame,
  Target,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const USER_ID = "default";

function ZoneBar({ zones }) {
  if (!zones) return null;
  const z1 = zones.z1 || 0;
  const z2 = zones.z2 || 0;
  const z3 = zones.z3 || 0;
  const z4 = zones.z4 || 0;
  const z5 = zones.z5 || 0;
  
  return (
    <div className="flex h-3 rounded-sm overflow-hidden">
      <div style={{ width: `${z1}%` }} className="bg-chart-2/40" />
      <div style={{ width: `${z2}%` }} className="bg-chart-2" />
      <div style={{ width: `${z3}%` }} className="bg-chart-3" />
      <div style={{ width: `${z4}%` }} className="bg-chart-1/80" />
      <div style={{ width: `${z5}%` }} className="bg-chart-1" />
    </div>
  );
}

function SignalCard({ signal, t, getLoadIcon, getLoadColor, getIntensityIcon, getIntensityColor, getConsistencyColor }) {
  const getColor = () => {
    if (signal.key === "load") return getLoadColor(signal.status);
    if (signal.key === "intensity") return getIntensityColor(signal.status);
    return getConsistencyColor(signal.status);
  };
  
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 text-center">
        <div className={`flex justify-center mb-2 ${getColor()}`}>
          {signal.key === "load" && getLoadIcon(signal.status)}
          {signal.key === "intensity" && getIntensityIcon(signal.status)}
          {signal.key === "consistency" && <Calendar className="w-5 h-5" />}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
          {t(`digest.signals.${signal.key}`)}
        </p>
        <p className="font-mono text-xs font-semibold">
          {signal.key === "load" && signal.value !== null && (
            <span className={getLoadColor(signal.status)}>
              {signal.value > 0 ? "+" : ""}{signal.value}%
            </span>
          )}
          {signal.key === "intensity" && (
            <span className={getIntensityColor(signal.status)}>
              {t(`digest.intensity.${signal.status}`)}
            </span>
          )}
          {signal.key === "consistency" && (
            <span className={getConsistencyColor(signal.status)}>
              {signal.value}%
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Digest() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDigest();
  }, [lang]);

  const loadDigest = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const res = await axios.get(`${API}/coach/digest?user_id=${USER_ID}&language=${lang}`);
      setDigest(res.data);
    } catch (error) {
      console.error("Failed to load digest:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getLoadIcon = (status) => {
    if (status === "up") return <TrendingUp className="w-5 h-5" />;
    if (status === "down") return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getLoadColor = (status) => {
    if (status === "up") return "text-chart-1";
    if (status === "down") return "text-chart-4";
    return "text-chart-2";
  };

  const getIntensityIcon = (status) => {
    if (status === "hard") return <Flame className="w-5 h-5" />;
    if (status === "easy") return <Activity className="w-5 h-5" />;
    return <Target className="w-5 h-5" />;
  };

  const getIntensityColor = (status) => {
    if (status === "hard") return "text-chart-1";
    if (status === "easy") return "text-chart-2";
    return "text-primary";
  };

  const getConsistencyColor = (status) => {
    if (status === "high") return "text-chart-2";
    if (status === "moderate") return "text-chart-3";
    return "text-chart-4";
  };

  const formatDateRange = () => {
    if (!digest) return "";
    const start = new Date(digest.period_start);
    const end = new Date(digest.period_end);
    const locale = lang === "fr" ? "fr-FR" : "en-US";
    const opts = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString(locale, opts)} - ${end.toLocaleDateString(locale, opts)}`;
  };

  const getMetrics = () => {
    if (!digest || !digest.metrics) return null;
    return digest.metrics;
  };

  const getZones = () => {
    const m = getMetrics();
    if (!m) return null;
    return m.zone_distribution;
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 pb-24 md:pb-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t("digest.generating")}
          </span>
        </div>
      </div>
    );
  }

  const metrics = getMetrics();
  const zones = getZones();
  const signals = digest?.signals || [];
  const insights = digest?.insights || [];
  const hours = metrics ? Math.round(metrics.total_duration_min / 60 * 10) / 10 : 0;

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8" data-testid="digest-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-xl md:text-2xl uppercase tracking-tight font-bold mb-0.5">
            {t("digest.title")}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {formatDateRange()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadDigest(true)}
          disabled={refreshing}
          data-testid="refresh-digest"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="p-4">
          <p className="font-mono text-sm md:text-base leading-relaxed" data-testid="executive-summary">
            {digest?.executive_summary || t("digest.noData")}
          </p>
        </CardContent>
      </Card>

      {/* Visual Signals Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {signals.map((signal) => (
          <SignalCard 
            key={signal.key}
            signal={signal}
            t={t}
            getLoadIcon={getLoadIcon}
            getLoadColor={getLoadColor}
            getIntensityIcon={getIntensityIcon}
            getIntensityColor={getIntensityColor}
            getConsistencyColor={getConsistencyColor}
          />
        ))}
      </div>

      {/* Metrics Bar */}
      {metrics && (
        <Card className="bg-card border-border mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between divide-x divide-border">
              <div className="flex-1 text-center pr-3">
                <p className="font-mono text-lg md:text-xl font-bold text-foreground">
                  {metrics.total_sessions}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {t("digest.sessions")}
                </p>
              </div>
              <div className="flex-1 text-center px-3">
                <p className="font-mono text-lg md:text-xl font-bold text-foreground">
                  {metrics.total_distance_km}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {t("digest.km")}
                </p>
              </div>
              <div className="flex-1 text-center pl-3">
                <p className="font-mono text-lg md:text-xl font-bold text-foreground">
                  {hours}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {t("digest.hours")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone Distribution Bar */}
      {zones && (
        <Card className="bg-card border-border mb-4">
          <CardContent className="p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-3">
              {t("digest.zoneDistribution")}
            </p>
            <ZoneBar zones={zones} />
            <div className="flex justify-between mt-2">
              <span className="font-mono text-[8px] text-muted-foreground">Z1</span>
              <span className="font-mono text-[8px] text-muted-foreground">Z5</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coach Insights */}
      {insights.length > 0 && (
        <Card className="bg-card border-border mb-4">
          <CardContent className="p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-3">
              {t("digest.coachInsights")}
            </p>
            <div className="space-y-2">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-1 h-1 mt-2 rounded-full bg-primary flex-shrink-0" />
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    {insight}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deep Dive CTA */}
      <Button
        onClick={() => navigate("/coach")}
        data-testid="deep-dive-btn"
        className="w-full bg-muted hover:bg-muted/80 text-foreground border border-border rounded-none h-12 font-mono text-xs uppercase tracking-wider flex items-center justify-between px-4"
      >
        <span>{t("digest.deepDive")}</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
