import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { 
  ArrowLeft, 
  Heart, 
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Scale,
  Activity,
  MessageSquare,
  Loader2,
  Bike,
  Footprints,
  HeartPulse,
  Sparkles,
  Target,
  AlertTriangle,
  History,
  Clock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getWorkoutIcon = (type) => {
  if (type === "cycle") return Bike;
  return Footprints;
};

const formatDuration = (minutes) => {
  if (!minutes) return "--";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) return `${hrs}h${mins > 0 ? mins : ""}`;
  return `${mins}m`;
};

// Heart Rate Zones Visualization Component
const HRZonesChart = ({ zones, t }) => {
  if (!zones) return null;
  
  // Zone configuration with colors and labels
  const zoneConfig = [
    { key: "z1", color: "#3B82F6", label: "Z1", desc: "recovery" },
    { key: "z2", color: "#22C55E", label: "Z2", desc: "endurance" },
    { key: "z3", color: "#EAB308", label: "Z3", desc: "tempo" },
    { key: "z4", color: "#F97316", label: "Z4", desc: "threshold" },
    { key: "z5", color: "#EF4444", label: "Z5", desc: "max" },
  ];
  
  // Find max percentage for scaling
  const maxPct = Math.max(...zoneConfig.map(z => zones[z.key] || 0), 1);
  
  return (
    <div className="space-y-2">
      {zoneConfig.map((zone) => {
        const pct = zones[zone.key] || 0;
        const barWidth = Math.max((pct / maxPct) * 100, pct > 0 ? 8 : 0);
        
        return (
          <div key={zone.key} className="flex items-center gap-2">
            <span className="font-mono text-[10px] w-6 text-muted-foreground">
              {zone.label}
            </span>
            <div className="flex-1 h-5 bg-muted/30 relative overflow-hidden">
              <div 
                className="h-full transition-all duration-500 ease-out flex items-center"
                style={{ 
                  width: `${barWidth}%`,
                  backgroundColor: zone.color,
                  minWidth: pct > 0 ? "24px" : "0"
                }}
              >
                {pct > 0 && (
                  <span className="font-mono text-[10px] text-white font-semibold px-1.5 drop-shadow-sm">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
            <span className="font-mono text-[9px] w-16 text-muted-foreground hidden sm:block">
              {t(`zones.${zone.desc}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Zone summary component
const ZoneSummary = ({ zones, t }) => {
  if (!zones) return null;
  
  const easyPct = (zones.z1 || 0) + (zones.z2 || 0);
  const moderatePct = zones.z3 || 0;
  const hardPct = (zones.z4 || 0) + (zones.z5 || 0);
  
  // Determine dominant zone type
  let dominant = "balanced";
  let dominantColor = "text-chart-3";
  
  if (hardPct >= 50) {
    dominant = "hard";
    dominantColor = "text-chart-1";
  } else if (easyPct >= 60) {
    dominant = "easy";
    dominantColor = "text-chart-2";
  }
  
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
      <div className="flex gap-4">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold text-chart-2">{easyPct}%</p>
          <p className="font-mono text-[8px] text-muted-foreground uppercase">{t("zones.easy")}</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xs font-semibold text-chart-3">{moderatePct}%</p>
          <p className="font-mono text-[8px] text-muted-foreground uppercase">{t("zones.moderate")}</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xs font-semibold text-chart-1">{hardPct}%</p>
          <p className="font-mono text-[8px] text-muted-foreground uppercase">{t("zones.hard")}</p>
        </div>
      </div>
      <div className={`px-2 py-1 rounded-sm ${dominant === "hard" ? "bg-chart-1/10" : dominant === "easy" ? "bg-chart-2/10" : "bg-chart-3/10"}`}>
        <p className={`font-mono text-[10px] font-semibold ${dominantColor}`}>
          {t(`zones.dominant_${dominant}`)}
        </p>
      </div>
    </div>
  );
};

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [workout, setWorkout] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [ragAnalysis, setRagAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkout();
  }, [id, lang]);

  const loadWorkout = async () => {
    setLoading(true);
    try {
      const [workoutRes, analysisRes, ragRes] = await Promise.all([
        axios.get(`${API}/workouts/${id}`),
        axios.get(`${API}/coach/workout-analysis/${id}?language=${lang}`),
        axios.get(`${API}/rag/workout/${id}`).catch(() => ({ data: null }))
      ]);
      setWorkout(workoutRes.data);
      setAnalysis(analysisRes.data);
      setRagAnalysis(ragRes.data);
    } catch (error) {
      console.error("Failed to load workout:", error);
      try {
        const res = await axios.get(`${API}/workouts/${id}`);
        setWorkout(res.data);
      } catch (e) {
        console.error("Workout not found");
      }
    } finally {
      setLoading(false);
    }
  };

  const goToDeepAnalysis = () => {
    navigate(`/workout/${id}/analysis`);
  };

  const goToAskCoach = () => {
    navigate("/coach");
  };

  if (loading) {
    return (
      <div className="p-4 pb-24 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="p-4 pb-24" data-testid="workout-not-found">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase">{t("workout.back")}</span>
        </Link>
        <p className="text-muted-foreground">{t("workout.notFound")}</p>
      </div>
    );
  }

  const Icon = getWorkoutIcon(workout.type);
  const typeLabel = t(`workoutTypes.${workout.type}`) || workout.type;
  const dateStr = new Date(workout.date).toLocaleDateString(
    lang === "fr" ? "fr-FR" : "en-US",
    { weekday: "short", month: "short", day: "numeric" }
  );

  // Session type styling
  const getSessionTypeStyle = (label) => {
    if (label === "hard") return "text-chart-1 bg-chart-1/10";
    if (label === "easy") return "text-chart-2 bg-chart-2/10";
    return "text-chart-3 bg-chart-3/10";
  };

  return (
    <div className="p-4 pb-24" data-testid="workout-detail">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{typeLabel}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{dateStr}</span>
      </div>

      {/* Workout Title */}
      <h1 className="font-heading text-base uppercase tracking-tight font-bold mb-4 leading-tight">
        {workout.name}
      </h1>

      {/* 1) Coach Summary - Top */}
      {analysis?.coach_summary && (
        <Card className="bg-card border-border mb-3">
          <CardContent className="p-3">
            <p className="font-mono text-sm leading-relaxed" data-testid="coach-summary">
              {analysis.coach_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 2) Session Snapshot - 3 Cards */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Card A - Intensity */}
        {analysis?.intensity && (
          <Card className="bg-card border-border">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                  {t("analysis.intensity")}
                </span>
              </div>
              <p className="font-mono text-xs font-semibold leading-tight">
                {analysis.intensity.pace || "--"}
              </p>
              {analysis.intensity.avg_hr && (
                <p className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5" />
                  {analysis.intensity.avg_hr}
                </p>
              )}
              {analysis.intensity.label !== "normal" && (
                <p className={`font-mono text-[9px] mt-1 ${
                  analysis.intensity.label === "above_usual" ? "text-chart-1" : "text-chart-2"
                }`}>
                  {t(`analysis.labels.${analysis.intensity.label}`)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card B - Load */}
        {analysis?.load && (
          <Card className="bg-card border-border">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <Scale className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                  {t("analysis.load")}
                </span>
              </div>
              <p className="font-mono text-xs font-semibold leading-tight">
                {analysis.load.distance_km} km
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {formatDuration(analysis.load.duration_min)}
              </p>
              {analysis.load.direction !== "stable" && (
                <p className={`font-mono text-[9px] mt-1 flex items-center gap-0.5 ${
                  analysis.load.direction === "up" ? "text-chart-1" : "text-chart-4"
                }`}>
                  {analysis.load.direction === "up" ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {t(`analysis.load_${analysis.load.direction}`)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card C - Type */}
        {analysis?.session_type && (
          <Card className="bg-card border-border">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                  {t("analysis.type")}
                </span>
              </div>
              <div className={`inline-block px-2 py-1 rounded-sm ${getSessionTypeStyle(analysis.session_type.label)}`}>
                <p className="font-mono text-xs font-semibold">
                  {t(`analysis.session_types.${analysis.session_type.label}`)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 3) Heart Rate Zones Distribution */}
      {workout.effort_zone_distribution && (
        <Card className="bg-card border-border mb-3" data-testid="hr-zones-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="w-4 h-4 text-chart-1" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {t("analysis.hrZones")}
              </span>
              {workout.avg_heart_rate && (
                <span className="ml-auto font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {t("analysis.avgHr")}: {workout.avg_heart_rate} bpm
                </span>
              )}
            </div>
            <HRZonesChart zones={workout.effort_zone_distribution} t={t} />
            <ZoneSummary zones={workout.effort_zone_distribution} t={t} />
          </CardContent>
        </Card>
      )}

      {/* 4) Coach Insight */}
      {analysis?.insight && (
        <Card className="bg-card border-border mb-3">
          <CardContent className="p-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
              {t("analysis.coachInsight")}
            </p>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed" data-testid="coach-insight">
              {analysis.insight}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 5) Guidance (Optional) */}
      {analysis?.guidance && (
        <Card className="bg-primary/5 border-primary/20 mb-3">
          <CardContent className="p-3">
            <p className="font-mono text-xs text-primary leading-relaxed" data-testid="guidance">
              {analysis.guidance}
            </p>
          </CardContent>
        </Card>
      )}

      {/* RAG ENRICHED ANALYSIS - NEW */}
      {ragAnalysis && (
        <Card className="bg-card border-border mb-3" data-testid="rag-workout-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {lang === "fr" ? "Analyse RAG" : "RAG Analysis"}
              </p>
            </div>
            
            {/* RAG Summary - first few lines */}
            <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-3 whitespace-pre-line" data-testid="rag-workout-summary">
              {ragAnalysis.rag_summary?.split('\n').slice(0, 4).join('\n')}
            </p>

            {/* Split Analysis - NEW */}
            {ragAnalysis.workout?.split_analysis && Object.keys(ragAnalysis.workout.split_analysis).length > 0 && (
              <div className="p-2 bg-blue-500/10 rounded-sm mb-3" data-testid="split-analysis-card">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span className="font-mono text-[9px] uppercase text-blue-400">
                    {lang === "fr" ? "Analyse des Splits" : "Split Analysis"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "fr" ? "Km le + rapide" : "Fastest km"}
                    </p>
                    <p className="font-mono text-emerald-400 font-semibold">
                      Km {ragAnalysis.workout.split_analysis.fastest_km} 
                      <span className="text-muted-foreground ml-1">
                        ({Math.floor(ragAnalysis.workout.split_analysis.fastest_split_pace)}:{String(Math.round((ragAnalysis.workout.split_analysis.fastest_split_pace % 1) * 60)).padStart(2, '0')})
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "fr" ? "Km le + lent" : "Slowest km"}
                    </p>
                    <p className="font-mono text-amber-400 font-semibold">
                      Km {ragAnalysis.workout.split_analysis.slowest_km}
                      <span className="text-muted-foreground ml-1">
                        ({Math.floor(ragAnalysis.workout.split_analysis.slowest_split_pace)}:{String(Math.round((ragAnalysis.workout.split_analysis.slowest_split_pace % 1) * 60)).padStart(2, '0')})
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "fr" ? "Écart allure" : "Pace drop"}
                    </p>
                    <p className="font-mono font-semibold">
                      {ragAnalysis.workout.split_analysis.pace_drop > 0 ? '+' : ''}{Math.round(ragAnalysis.workout.split_analysis.pace_drop * 60)}s/km
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "fr" ? "Régularité" : "Consistency"}
                    </p>
                    <p className={`font-mono font-semibold ${
                      ragAnalysis.workout.split_analysis.consistency_score >= 80 ? 'text-emerald-400' :
                      ragAnalysis.workout.split_analysis.consistency_score >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {Math.round(ragAnalysis.workout.split_analysis.consistency_score)}%
                    </p>
                  </div>
                </div>
                {ragAnalysis.workout.split_analysis.negative_split && (
                  <div className="mt-2 px-2 py-1 bg-emerald-500/20 rounded-sm">
                    <p className="font-mono text-[10px] text-emerald-400 font-semibold">
                      ✨ Negative Split - {lang === "fr" ? "Tu as accéléré en fin de sortie !" : "You sped up at the end!"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* HR Analysis - NEW */}
            {ragAnalysis.workout?.hr_analysis && Object.keys(ragAnalysis.workout.hr_analysis).length > 0 && (
              <div className="p-2 bg-red-500/10 rounded-sm mb-3" data-testid="hr-analysis-card">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span className="font-mono text-[9px] uppercase text-red-400">
                    {lang === "fr" ? "Analyse Cardiaque" : "Heart Rate Analysis"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">Min</p>
                    <p className="font-mono font-semibold">{ragAnalysis.workout.hr_analysis.min_hr} bpm</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">Moy</p>
                    <p className="font-mono font-semibold">{ragAnalysis.workout.hr_analysis.avg_hr} bpm</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground">Max</p>
                    <p className="font-mono font-semibold">{ragAnalysis.workout.hr_analysis.max_hr} bpm</p>
                  </div>
                </div>
                {ragAnalysis.workout.hr_analysis.hr_drift !== 0 && (
                  <div className="mt-2">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lang === "fr" ? "Dérive cardiaque" : "HR Drift"}
                    </p>
                    <p className={`font-mono text-xs font-semibold ${
                      Math.abs(ragAnalysis.workout.hr_analysis.hr_drift) > 10 ? 'text-amber-400' : 'text-muted-foreground'
                    }`}>
                      {ragAnalysis.workout.hr_analysis.hr_drift > 0 ? '+' : ''}{ragAnalysis.workout.hr_analysis.hr_drift} bpm
                      {Math.abs(ragAnalysis.workout.hr_analysis.hr_drift) > 10 && (
                        <span className="ml-2 text-[10px]">
                          ({lang === "fr" ? "Hydratation à surveiller" : "Watch hydration"})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Comparison with similar workouts */}
            {ragAnalysis.comparison?.similar_found > 0 && (
              <div className="p-2 bg-muted/30 rounded-sm mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <History className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">
                    {lang === "fr" ? "Comparaison" : "Comparison"}
                  </span>
                </div>
                <p className="font-mono text-xs">
                  {ragAnalysis.comparison.similar_found} {lang === "fr" ? "séances similaires" : "similar workouts"}
                </p>
                {ragAnalysis.comparison.progression && (
                  <p className={`font-mono text-xs mt-1 ${
                    ragAnalysis.comparison.progression.includes('plus rapide') || ragAnalysis.comparison.progression.includes('faster')
                      ? 'text-emerald-400' 
                      : 'text-amber-400'
                  }`}>
                    {ragAnalysis.comparison.progression.includes('plus rapide') || ragAnalysis.comparison.progression.includes('faster') ? (
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 inline mr-1" />
                    )}
                    {ragAnalysis.comparison.progression}
                  </p>
                )}
                {ragAnalysis.comparison.splits_comparison && (
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">
                    {ragAnalysis.comparison.splits_comparison}
                  </p>
                )}
                {ragAnalysis.comparison.date_precedente && (
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lang === "fr" ? "vs" : "vs"} {ragAnalysis.comparison.date_precedente}
                  </p>
                )}
              </div>
            )}
            
            {/* Points forts & améliorer */}
            {(ragAnalysis.points_forts?.length > 0 || ragAnalysis.points_ameliorer?.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {ragAnalysis.points_forts?.slice(0, 2).map((point, i) => (
                  <span key={`fort-${i}`} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-sm">
                    <Target className="w-3 h-3" />
                    <span className="font-mono text-[10px]">{point}</span>
                  </span>
                ))}
                {ragAnalysis.points_ameliorer?.slice(0, 1).map((point, i) => (
                  <span key={`ameliorer-${i}`} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded-sm">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-mono text-[10px]">{point}</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6) Actions */}
      <div className="space-y-2 mt-4">
        <Button
          onClick={goToDeepAnalysis}
          data-testid="deep-analysis-btn"
          className="w-full bg-primary text-white hover:bg-primary/90 rounded-none h-10 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {t("analysis.viewDetailedAnalysis")}
        </Button>
        <Button
          onClick={goToAskCoach}
          variant="ghost"
          data-testid="ask-coach-btn"
          className="w-full text-muted-foreground hover:text-foreground rounded-none h-9 font-mono text-[11px] uppercase tracking-wider"
        >
          {t("analysis.askCoach")}
        </Button>
      </div>
    </div>
  );
}
