import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  Activity,
  ChevronRight,
  Bike,
  Footprints,
  Calendar,
  Zap,
  AlertTriangle,
  Target,
  Loader2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const USER_ID = "default";

const getWorkoutIcon = (type) => {
  switch (type) {
    case "cycle":
      return Bike;
    case "run":
    default:
      return Footprints;
  }
};

const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

const CustomTooltip = ({ active, payload, label, t }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-3">
        <p className="font-mono text-xs text-muted-foreground mb-1">{label}</p>
        <p className="font-mono text-sm font-medium">
          {payload[0].value.toFixed(1)} {t("dashboard.km")}
        </p>
      </div>
    );
  }
  return null;
};

// VMA Estimate Component
function VMAEstimateCard({ t, lang }) {
  const [vmaData, setVmaData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVMA = async () => {
      try {
        const res = await axios.get(`${API}/user/vma-estimate?user_id=${USER_ID}&language=${lang}`);
        setVmaData(res.data);
      } catch (error) {
        console.error("Failed to fetch VMA estimate:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVMA();
  }, [lang]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!vmaData) return null;

  const getConfidenceColor = (confidence) => {
    if (confidence === "high") return "text-emerald-400";
    if (confidence === "medium") return "text-amber-400";
    if (confidence === "low") return "text-orange-400";
    return "text-red-400";
  };

  const getConfidenceBars = (score) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-2 h-3 ${
              i <= score 
                ? score >= 4 ? "bg-emerald-400" : score >= 3 ? "bg-amber-400" : "bg-orange-400"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  // Insufficient data
  if (!vmaData.has_sufficient_data) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-muted border border-border flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
                {t("progress.vmaEstimate")}
              </h3>
              <p className="font-mono text-xs text-amber-400 mb-3">
                {t("progress.insufficientData")}
              </p>
              <p className="font-mono text-sm text-muted-foreground mb-3">
                {vmaData.message}
              </p>
              {vmaData.recommendations && (
                <ul className="space-y-1">
                  {vmaData.recommendations.map((rec, idx) => (
                    <li key={idx} className="font-mono text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span> {rec}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has sufficient data
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-primary/10 border border-primary/30 flex-shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
              {t("progress.vmaEstimate")}
            </h3>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xs uppercase ${getConfidenceColor(vmaData.confidence)}`}>
                {t(`progress.confidenceLevels.${vmaData.confidence}`)}
              </span>
              {getConfidenceBars(vmaData.confidence_score)}
            </div>
          </div>
        </div>

        {/* VMA and VO2max values */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {t("progress.vma")}
            </p>
            <p className="font-mono text-3xl font-bold text-primary">
              {vmaData.vma_kmh}
            </p>
            <p className="font-mono text-xs text-muted-foreground">km/h</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {t("progress.vo2max")}
            </p>
            <p className="font-mono text-3xl font-bold text-foreground">
              {vmaData.vo2max}
            </p>
            <p className="font-mono text-xs text-muted-foreground">ml/kg/min</p>
          </div>
        </div>

        {/* Data source */}
        <p className="font-mono text-xs text-muted-foreground mb-4">
          {t("progress.dataSource")}: {vmaData.data_source}
        </p>

        {/* Training zones */}
        {vmaData.training_zones && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              {t("progress.trainingZones")}
            </p>
            <div className="space-y-2">
              {Object.entries(vmaData.training_zones).map(([zone, info]) => (
                <div key={zone} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${
                      zone === "z5" ? "bg-red-500/20 text-red-400" :
                      zone === "z4" ? "bg-orange-500/20 text-orange-400" :
                      zone === "z3" ? "bg-amber-500/20 text-amber-400" :
                      zone === "z2" ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {zone.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {info.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {info.pct_vma}
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      {info.pace_range}/km
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {vmaData.recommendations && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="space-y-1">
              {vmaData.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Target className="w-3 h-3 text-primary flex-shrink-0 mt-1" />
                  <p className="font-mono text-xs text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();

  const dateLocale = t("dateFormat.locale");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, workoutsRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/workouts`)
        ]);
        setStats(statsRes.data);
        setWorkouts(workoutsRes.data);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-8" />
        <div className="h-64 bg-muted rounded mb-8" />
      </div>
    );
  }

  // Prepare chart data with localized day names
  const chartData = stats?.weekly_summary?.map(day => ({
    date: new Date(day.date).toLocaleDateString(dateLocale, { weekday: "short" }),
    distance: day.distance,
    count: day.count
  })) || [];

  const typeData = stats?.workouts_by_type || {};

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8" data-testid="progress-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl md:text-3xl uppercase tracking-tight font-bold mb-1">
          {t("progress.title")}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t("progress.subtitle")}
        </p>
      </div>

      {/* VMA Estimate Card - NEW */}
      <div className="mb-8">
        <VMAEstimateCard t={t} lang={lang} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card className="metric-card bg-card border-border">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="data-label">{t("progress.totalVolume")}</span>
              <TrendingUp className="w-4 h-4 text-chart-2" />
            </div>
            <p className="font-heading text-3xl md:text-4xl font-bold">
              {stats?.total_distance_km?.toFixed(0) || 0}
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-1">{t("progress.kilometers")}</p>
          </CardContent>
        </Card>

        <Card className="metric-card bg-card border-border">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="data-label">{t("progress.sessions")}</span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <p className="font-heading text-3xl md:text-4xl font-bold">
              {stats?.total_workouts || 0}
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-1">{t("progress.workouts")}</p>
          </CardContent>
        </Card>

        <Card className="metric-card bg-card border-border col-span-2 md:col-span-1">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="data-label">{t("progress.byType")}</span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-4">
              {Object.entries(typeData).map(([type, count]) => {
                const Icon = getWorkoutIcon(type);
                return (
                  <div key={type} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distance Chart */}
      {chartData.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-4">
            {t("progress.dailyDistance")}
          </h2>
          <Card className="chart-container">
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  />
                  <Tooltip content={(props) => <CustomTooltip {...props} t={t} />} cursor={false} />
                  <Bar dataKey="distance" radius={[0, 0, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.distance > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Workouts */}
      <div>
        <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-4">
          {t("progress.allWorkouts")}
        </h2>
        <div className="space-y-3">
          {workouts.slice(0, 20).map((workout, index) => {
            const Icon = getWorkoutIcon(workout.type);
            const typeLabel = t(`workoutTypes.${workout.type}`) || workout.type;
            return (
              <Link
                key={workout.id}
                to={`/workout/${workout.id}`}
                data-testid={`progress-workout-${workout.id}`}
                className="block animate-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <Card className="metric-card bg-card border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-muted border border-border">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="workout-type-badge">
                            {typeLabel}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(workout.date).toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric"
                            })}
                          </span>
                        </div>
                        <p className="font-medium text-sm truncate">
                          {workout.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono text-sm font-medium">
                            {workout.distance_km.toFixed(1)} {t("dashboard.km")}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {formatDuration(workout.duration_minutes)}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
