import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import studioLogo from "@/assets/studio-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("remembered_email");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  // Auto-login if session exists
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/tool");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (rememberMe) {
          localStorage.setItem("remembered_email", email);
        } else {
          localStorage.removeItem("remembered_email");
        }

        toast.success("התחברת בהצלחה!");
        navigate("/tool");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("נרשמת בהצלחה! בדוק את המייל לאימות.");
      }
    } catch (err: any) {
      const msg = err.message || "שגיאה";
      // Translate common Supabase errors to Hebrew
      if (msg.includes("Invalid login")) toast.error("אימייל או סיסמה שגויים");
      else if (msg.includes("Email not confirmed")) toast.error("יש לאמת את האימייל לפני התחברות");
      else if (msg.includes("already registered")) toast.error("האימייל כבר רשום — נסה להתחבר");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("הזן אימייל לפני שליחת איפוס");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) throw error;
      toast.success("קישור לאיפוס סיסמה נשלח לאימייל שלך!");
      setShowForgotPassword(false);
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשליחת איפוס");
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

          {isLogin && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-gold"
                />
                <span className="font-body text-sm text-muted-foreground">זכור אותי</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="font-body text-xs text-gold hover:underline"
              >
                שכחתי סיסמה
              </button>
            </div>
          )}

          {!isLogin && password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4].map((level) => {
                  const strength =
                    (password.length >= 6 ? 1 : 0) +
                    (/[A-Z]/.test(password) ? 1 : 0) +
                    (/[0-9]/.test(password) ? 1 : 0) +
                    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
                  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
                  return (
                    <div
                      key={level}
                      className={`flex-1 rounded-full ${level <= strength ? colors[strength - 1] : "bg-border"}`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {password.length < 6 ? "מינימום 6 תווים" : "מומלץ: אותיות גדולות, מספרים וסימנים"}
              </p>
            </div>
          )}

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

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl" onClick={() => setShowForgotPassword(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg font-bold text-foreground">איפוס סיסמה</h3>
              <p className="font-body text-sm text-muted-foreground">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
                placeholder="example@email.com"
                dir="ltr"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 rounded-lg border border-border py-2.5 font-display text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-gold py-2.5 font-display text-xs font-semibold text-gold-foreground hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {loading ? "שולח..." : "שלח קישור"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
