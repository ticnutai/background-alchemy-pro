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

  const passwordStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthColors = ["bg-destructive", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthLabels = ["חלשה", "בינונית", "טובה", "חזקה"];

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
      if (showForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("נשלח מייל לאיפוס סיסמה. בדוק את תיבת הדואר.");
        setShowForgotPassword(false);
      } else if (isLogin) {
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
            {showForgotPassword ? "איפוס סיסמה" : isLogin ? "התחברות" : "הרשמה"}
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            {showForgotPassword ? "הכנס את כתובת המייל ונשלח לך קישור לאיפוס" : isLogin ? "התחבר כדי לשמור היסטוריית עיבודים ומועדפים" : "צור חשבון חדש"}
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
          {!showForgotPassword && (
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
            {!isLogin && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="font-body text-xs text-muted-foreground">
                  חוזק: {strengthLabels[passwordStrength - 1] || "חלשה מאוד"}
                </p>
              </div>
            )}
          </div>
          )}

          {isLogin && !showForgotPassword && (
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
                className="font-body text-sm text-gold hover:underline"
              >
                שכחתי סיסמה
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold py-3.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "טוען..." : showForgotPassword ? "שלח מייל איפוס" : isLogin ? "התחבר" : "הירשם"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForgotPassword(false); setIsLogin(!isLogin); }}
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
