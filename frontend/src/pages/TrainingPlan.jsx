import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, Calendar, TrendingUp, RefreshCw, CheckCircle2, 
  AlertTriangle, Zap, Clock, Activity, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const USER_ID = "default";

const GOAL_OPTIONS = [
  { value: "5K", label: "5 km", weeks: 6 },
  { value: "10K", label: "10 km", weeks: 8 },
  { value: "SEMI", label: "Semi-Marathon", weeks: 12 },
  { value: "MARATHON", label: "Marathon", weeks: 16 },
  { value: "ULTRA", label: "Ultra-Trail", weeks: 20 },
];

const INTENSITY_COLORS = {
  rest: "bg-slate-100 text-slate-600 border-slate-200",
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-red-100 text-red-700 border-red-200",
  race: "bg-purple-100 text-purple-700 border-purple-200",
};

const PHASE_COLORS = {
  build: "bg-blue-500",
  deload: "bg-green-500",
  intensification: "bg-orange-500",
  taper: "bg-purple-500",
  race: "bg-red-500",
};

export default function TrainingPlan() {
  const { t, lang } = useLanguage();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingGoal, setSettingGoal] = useState(false);

  const fetchPlan = async () => {
    try {
      const res = await axios.get(`${API}/training/plan`, {
        headers: { "X-User-Id": USER_ID }
      });
      setPlan(res.data);
    } catch (err) {
      console.error("Error fetching plan:", err);
      toast.error(lang === "fr" ? "Erreur de chargement" : "Loading error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post(`${API}/training/refresh`, {}, {
        headers: { "X-User-Id": USER_ID }
      });
      setPlan(res.data);
      toast.success(lang === "fr" ? "Plan mis à jour" : "Plan updated");
    } catch (err) {
      toast.error(lang === "fr" ? "Erreur" : "Error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetGoal = async (goal) => {
    setSettingGoal(true);
    try {
      await axios.post(`${API}/training/set-goal?goal=${goal}`, {}, {
        headers: { "X-User-Id": USER_ID }
      });
      toast.success(lang === "fr" ? `Objectif ${goal} défini` : `Goal ${goal} set`);
      fetchPlan();
    } catch (err) {
      toast.error(lang === "fr" ? "Erreur" : "Error");
    } finally {
      setSettingGoal(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const context = plan?.context || {};
  const sessions = plan?.plan?.sessions || [];
  const phaseInfo = plan?.phase_info || {};

  return (
    <div className="p-6 space-y-6" data-testid="training-plan-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-tight">
            {lang === "fr" ? "Plan d'Entraînement" : "Training Plan"}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {lang === "fr" ? "Semaine" : "Week"} {plan?.week || 1} / {plan?.goal_config?.cycle_weeks || "?"} 
            {" • "}
            <span className="capitalize">{phaseInfo.name || plan?.phase}</span>
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="refresh-plan-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {lang === "fr" ? "Actualiser" : "Refresh"}
        </Button>
      </div>

      {/* Objectif & Métriques */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Objectif */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              {lang === "fr" ? "Objectif" : "Goal"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plan?.goal || "—"}</div>
            <p className="text-xs text-muted-foreground">
              {plan?.goal_config?.description || ""}
            </p>
          </CardContent>
        </Card>

        {/* Phase */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Phase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${PHASE_COLORS[plan?.phase] || "bg-gray-400"}`} />
              <span className="text-lg font-semibold capitalize">{phaseInfo.name || plan?.phase}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {phaseInfo.focus || ""}
            </p>
          </CardContent>
        </Card>

        {/* ACWR */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ACWR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{context.acwr?.toFixed(2) || "—"}</span>
              {context.acwr > 1.3 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : context.acwr >= 0.8 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {context.acwr > 1.3 
                ? (lang === "fr" ? "Attention charge" : "High load") 
                : (lang === "fr" ? "Zone optimale" : "Optimal zone")}
            </p>
          </CardContent>
        </Card>

        {/* TSB */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              TSB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${context.tsb > 0 ? "text-emerald-600" : context.tsb < -20 ? "text-red-600" : ""}`}>
                {context.tsb?.toFixed(1) || "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {context.tsb > 0 
                ? (lang === "fr" ? "Fraîcheur" : "Fresh") 
                : (lang === "fr" ? "Fatigue" : "Fatigue")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sélection d'objectif */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Target className="w-4 h-4" />
            {lang === "fr" ? "Changer d'objectif" : "Change Goal"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={plan?.goal === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleSetGoal(opt.value)}
                disabled={settingGoal}
                data-testid={`goal-btn-${opt.value}`}
              >
                {opt.label}
                <span className="ml-1 text-xs opacity-60">({opt.weeks}s)</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan de la semaine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {lang === "fr" ? "Séances de la semaine" : "Weekly Sessions"}
            <Badge variant="secondary" className="ml-2">
              {plan?.plan?.total_tss || 0} TSS
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 p-3 rounded-lg border ${INTENSITY_COLORS[session.intensity] || "bg-gray-50"}`}
                data-testid={`session-${session.day}`}
              >
                <div className="w-20 shrink-0">
                  <span className="font-mono text-xs font-semibold uppercase">
                    {session.day}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{session.type}</span>
                    {session.duration !== "0min" && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.duration}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.details}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {session.estimated_tss} TSS
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conseil du coach */}
      {plan?.plan?.advice && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground mb-1">
                  {lang === "fr" ? "Conseil du coach" : "Coach advice"}
                </p>
                <p className="text-sm">{plan.plan.advice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
