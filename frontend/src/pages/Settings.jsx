import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { Globe, Info } from "lucide-react";

export default function Settings() {
  const { t, lang, setLang } = useLanguage();

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

      {/* Language Setting */}
      <div className="space-y-6">
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
                  {t("settings.version")} 1.0.0
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
