import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import studioLogo from "@/assets/studio-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("התחברת בהצלחה!");
        navigate("/tool");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("נרשמת בהצלחה! בדוק את המייל לאימות.");
      }
    } catch (err: any) {
      toast.error(err.message || "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src={studioLogo} alt="רותי פרל" className="h-20 mx-auto mb-6" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            {isLogin ? "התחברות" : "הרשמה"}
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            {isLogin ? "התחבר כדי לשמור היסטוריית עיבודים ומועדפים" : "צור חשבון חדש"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div>
            <label className="font-accent text-xs text-muted-foreground mb-1.5 block">דוא״ל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
              placeholder="example@email.com"
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="font-accent text-xs text-muted-foreground mb-1.5 block">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
              placeholder="••••••••"
              dir="ltr"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold py-3.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "טוען..." : isLogin ? "התחבר" : "הירשם"}
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "אין לך חשבון? הירשם" : "יש לך חשבון? התחבר"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
