import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { Globe, Info, Link2, Loader2, Check, X, RefreshCw, Target, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const USER_ID = "default";

export default function Settings() {
  const { t, lang, setLang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stravaStatus, setStravaStatus] = useState(null);
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Goal state
  const [goal, setGoal] = useState(null);
  const [loadingGoal, setLoadingGoal] = useState(true);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    loadStravaStatus();
    loadGoal();
    
    // Handle OAuth callback
    const stravaParam = searchParams.get("strava");
    if (stravaParam === "connected") {
      toast.success(lang === "fr" ? "Compte connecte" : "Account connected");
      setSearchParams({});
      triggerInitialSync();
    } else if (stravaParam === "error") {
      toast.error(lang === "fr" ? "Erreur de connexion" : "Connection failed");
      setSearchParams({});
    }
  }, [searchParams]);

  const loadGoal = async () => {
    try {
      const res = await axios.get(`${API}/user/goal?user_id=${USER_ID}`);
      if (res.data) {
        setGoal(res.data);
        setEventName(res.data.event_name);
        setEventDate(res.data.event_date);
      }
    } catch (error) {
      console.error("Failed to load goal:", error);
    } finally {
      setLoadingGoal(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!eventName.trim() || !eventDate) {
      toast.error(lang === "fr" ? "Remplis tous les champs" : "Fill all fields");
      return;
    }
    
    setSavingGoal(true);
    try {
      const res = await axios.post(`${API}/user/goal?user_id=${USER_ID}`, {
        event_name: eventName.trim(),
        event_date: eventDate
      });
      setGoal(res.data.goal);
      toast.success(t("settings.goalSaved"));
    } catch (error) {
      console.error("Failed to save goal:", error);
      toast.error(lang === "fr" ? "Erreur" : "Error");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async () => {
    try {
      await axios.delete(`${API}/user/goal?user_id=${USER_ID}`);
      setGoal(null);
      setEventName("");
      setEventDate("");
      toast.success(t("settings.goalDeleted"));
    } catch (error) {
      console.error("Failed to delete goal:", error);
      toast.error(lang === "fr" ? "Erreur" : "Error");
    }
  };

  const triggerInitialSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/strava/sync?user_id=${USER_ID}`);
      if (res.data.success) {
        const msg = lang === "fr" 
          ? `${res.data.synced_count} seances importees` 
          : `${res.data.synced_count} workouts imported`;
        toast.success(msg);
      }
      loadStravaStatus();
    } catch (error) {
      console.error("Initial sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const loadStravaStatus = async () => {
    try {
      const res = await axios.get(`${API}/strava/status?user_id=${USER_ID}`);
      setStravaStatus(res.data);
    } catch (error) {
      console.error("Failed to load connection status:", error);
      setStravaStatus({ connected: false, last_sync: null, workout_count: 0 });
    } finally {
      setLoadingStrava(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await axios.get(`${API}/strava/authorize?user_id=${USER_ID}`);
      window.location.href = res.data.authorization_url;
    } catch (error) {
      console.error("Failed to initiate auth:", error);
      const message = error.response?.data?.detail || (lang === "fr" ? "Erreur de connexion" : "Connection failed");
      toast.error(message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.delete(`${API}/strava/disconnect?user_id=${USER_ID}`);
      setStravaStatus({ connected: false, last_sync: null, workout_count: 0 });
      toast.success(lang === "fr" ? "Compte deconnecte" : "Account disconnected");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error(lang === "fr" ? "Erreur" : "Error");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/strava/sync?user_id=${USER_ID}`);
      if (res.data.success) {
        toast.success(res.data.message);
        loadStravaStatus();
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      toast.error(lang === "fr" ? "Erreur de synchronisation" : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSync = (isoString) => {
    if (!isoString) return lang === "fr" ? "Jamais" : "Never";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (lang === "fr") {
      if (diffMins < 1) return "A l'instant";
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays < 7) return `Il y a ${diffDays}j`;
      return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  const calculateDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const eventDate = new Date(dateStr);
    const today = new Date();
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

  const daysUntil = goal ? calculateDaysUntil(goal.event_date) : null;

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8" data-testid="settings-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl md:text-3xl uppercase tracking-tight font-bold mb-1">
          {t("settings.title")}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Training Goal Section - NEW */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-muted border border-border flex-shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
                  {t("settings.goal")}
                </h2>
                <p className="font-mono text-xs text-muted-foreground mb-4">
                  {t("settings.goalDesc")}
                </p>
                
                {loadingGoal ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-mono text-xs">{t("common.loading")}</span>
                  </div>
                ) : goal && daysUntil ? (
                  <div className="space-y-4">
                    {/* Current Goal Display */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {goal.event_name}
                        </span>
                        <Button
                          onClick={handleDeleteGoal}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="font-mono text-xs">
                          {new Date(goal.event_date).toLocaleDateString(
                            lang === "fr" ? "fr-FR" : "en-US",
                            { day: "numeric", month: "long", year: "numeric" }
                          )}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-primary/20">
                        <p className="font-mono text-2xl font-bold text-primary">
                          {daysUntil} <span className="text-sm font-normal">{t("settings.daysUntil")}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Goal Form */}
                    <div className="space-y-3">
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">
                          {t("settings.eventName")}
                        </label>
                        <Input
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder={lang === "fr" ? "Ex: Marathon de Paris" : "Ex: Paris Marathon"}
                          className="bg-muted border-border font-mono text-sm"
                          data-testid="goal-name-input"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">
                          {t("settings.eventDate")}
                        </label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="bg-muted border-border font-mono text-sm"
                          data-testid="goal-date-input"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveGoal}
                      disabled={savingGoal || !eventName.trim() || !eventDate}
                      data-testid="save-goal"
                      className="bg-primary text-white hover:bg-primary/90 rounded-none uppercase font-bold tracking-wider text-xs h-9 px-4 flex items-center gap-2"
                    >
                      {savingGoal ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {t("settings.saveGoal")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Sync Section */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-muted border border-border flex-shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
                  {t("settings.dataSync")}
                </h2>
                <p className="font-mono text-xs text-muted-foreground mb-4">
                  {t("settings.dataSyncDesc")}
                </p>
                
                {loadingStrava ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-mono text-xs">{t("common.loading")}</span>
                  </div>
                ) : stravaStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-chart-2">
                      <Check className="w-4 h-4" />
                      <span className="font-mono text-xs uppercase tracking-wider">
                        {t("settings.connected")}
                      </span>
                    </div>
                    
                    <div className="p-3 bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            {t("settings.lastSync")}
                          </p>
                          <p className="font-mono text-sm">
                            {formatLastSync(stravaStatus.last_sync)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            {t("settings.workouts")}
                          </p>
                          <p className="font-mono text-sm">
                            {stravaStatus.workout_count}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSync}
                        disabled={syncing}
                        data-testid="sync-strava"
                        className="bg-primary text-white hover:bg-primary/90 rounded-none uppercase font-bold tracking-wider text-xs h-9 px-4 flex items-center gap-2"
                      >
                        {syncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {t("settings.sync")}
                      </Button>
                      <Button
                        onClick={handleDisconnect}
                        variant="ghost"
                        data-testid="disconnect-strava"
                        className="text-muted-foreground hover:text-destructive rounded-none uppercase font-mono text-xs h-9 px-4"
                      >
                        {t("settings.disconnect")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <X className="w-4 h-4" />
                      <span className="font-mono text-xs uppercase tracking-wider">
                        {t("settings.notConnected")}
                      </span>
                    </div>
                    <Button
                      onClick={handleConnect}
                      disabled={connecting}
                      data-testid="connect-strava"
                      className="bg-primary text-white hover:bg-primary/90 rounded-none uppercase font-bold tracking-wider text-xs h-9 px-4 flex items-center gap-2"
                    >
                      {connecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      {t("settings.connect")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language Setting */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-muted border border-border flex-shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
                  {t("settings.language")}
                </h2>
                <p className="font-mono text-xs text-muted-foreground mb-4">
                  {t("settings.languageDesc")}
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setLang("en")}
                    data-testid="lang-en"
                    className={`flex-1 p-4 border font-mono text-sm uppercase tracking-wider transition-colors ${
                      lang === "en"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <span className="block text-lg mb-1">EN</span>
                    <span className="block text-xs">{t("settings.english")}</span>
                  </button>
                  
                  <button
                    onClick={() => setLang("fr")}
                    data-testid="lang-fr"
                    className={`flex-1 p-4 border font-mono text-sm uppercase tracking-wider transition-colors ${
                      lang === "fr"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <span className="block text-lg mb-1">FR</span>
                    <span className="block text-xs">{t("settings.french")}</span>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-muted border border-border flex-shrink-0">
                <Info className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-lg uppercase tracking-tight font-semibold mb-1">
                  {t("settings.about")}
                </h2>
                <p className="font-mono text-xs text-muted-foreground mb-4">
                  {t("settings.aboutDesc")}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("settings.version")} 1.3.0
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
