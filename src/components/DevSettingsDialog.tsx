import { useState, useCallback } from "react";
import { X, Terminal, Play, Loader2, CheckCircle2, AlertCircle, Settings, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MigrationResult {
  success: boolean;
  rows_affected?: number;
  duration_ms?: number;
  statement_type?: string;
  error?: string;
  detail?: string;
  hint?: string;
}

interface HistoryEntry {
  query: string;
  result: MigrationResult;
  timestamp: Date;
}

interface DevSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const DevSettingsDialog = ({ open, onClose }: DevSettingsDialogProps) => {
  const [sqlQuery, setSqlQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleRunMigration = useCallback(async () => {
    const query = sqlQuery.trim();
    if (!query) {
      toast.error("יש להזין שאילתת SQL");
      return;
    }

    setRunning(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.rpc("exec_sql", { query });

      if (error) throw error;

      const result = data as unknown as MigrationResult;
      setLastResult(result);
      setHistory((prev) => [{ query, result, timestamp: new Date() }, ...prev]);

      if (result.success) {
        toast.success(
          `✅ בוצע בהצלחה — ${result.statement_type} | ${result.rows_affected} שורות | ${result.duration_ms}ms`
        );
      } else {
        toast.error(`❌ שגיאה: ${result.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
      setLastResult({ success: false, error: msg });
    } finally {
      setRunning(false);
    }
  }, [sqlQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunMigration();
      }
    },
    [handleRunMigration]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[90vw] max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Settings className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">הגדרות פיתוח</h2>
              <p className="font-body text-xs text-muted-foreground">כלי ניהול למפתחים — גישה מוגבלת לאדמין</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Migration Runner */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-amber-500" />
                <h3 className="font-display text-sm font-bold text-foreground">הרצת מיגרציות</h3>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="font-body text-[10px] text-primary hover:underline"
                >
                  {showHistory ? "הסתר היסטוריה" : `היסטוריה (${history.length})`}
                </button>
              )}
            </div>

            <p className="font-body text-xs text-muted-foreground">
              הרץ שאילתות SQL ישירות על הדאטאבייס — CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, וכו׳
            </p>

            {/* SQL Editor */}
            <div className="relative">
              <div className="absolute top-2 right-3 flex items-center gap-1.5 pointer-events-none">
                <Code2 className="h-3 w-3 text-muted-foreground/50" />
                <span className="font-mono text-[9px] text-muted-foreground/50 uppercase">SQL</span>
              </div>
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`-- כתוב כאן את השאילתה שלך\n-- לדוגמה:\nCREATE TABLE public.test (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL\n);`}
                className="w-full rounded-xl border border-input bg-background p-4 pt-8 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                rows={8}
                dir="ltr"
                style={{ textAlign: "left" }}
              />
              <div className="absolute bottom-2 left-3">
                <span className="font-body text-[9px] text-muted-foreground/50">Ctrl+Enter להרצה</span>
              </div>
            </div>

            {/* Run button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunMigration}
                disabled={running || !sqlQuery.trim()}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-display text-sm font-bold text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {running ? "מריץ..." : "הרץ מיגרציה"}
              </button>
              {sqlQuery.trim() && (
                <button
                  onClick={() => {
                    setSqlQuery("");
                    setLastResult(null);
                  }}
                  className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  נקה
                </button>
              )}
            </div>

            {/* Result */}
            {lastResult && (
              <div
                className={`rounded-xl border-2 p-4 space-y-2 ${
                  lastResult.success
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-display text-sm font-bold text-foreground">
                    {lastResult.success ? "בוצע בהצלחה" : "שגיאה"}
                  </span>
                </div>

                {lastResult.success ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-background/50 p-2 text-center">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        {lastResult.statement_type}
                      </span>
                      <span className="block font-body text-[9px] text-muted-foreground">סוג</span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2 text-center">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        {lastResult.rows_affected}
                      </span>
                      <span className="block font-body text-[9px] text-muted-foreground">שורות</span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2 text-center">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        {lastResult.duration_ms}ms
                      </span>
                      <span className="block font-body text-[9px] text-muted-foreground">זמן</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-destructive" dir="ltr" style={{ textAlign: "left" }}>
                      {lastResult.error}
                    </p>
                    {lastResult.detail && (
                      <p className="font-mono text-[10px] text-muted-foreground" dir="ltr" style={{ textAlign: "left" }}>
                        Code: {lastResult.detail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History */}
          {showHistory && history.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <h4 className="font-display text-xs font-bold text-foreground">היסטוריית הרצות</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 cursor-pointer hover:bg-secondary/30 transition-colors ${
                      entry.result.success ? "border-green-500/20" : "border-destructive/20"
                    }`}
                    onClick={() => setSqlQuery(entry.query)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {entry.result.success ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className="font-mono text-[10px] text-foreground font-bold">
                          {entry.result.statement_type || "SQL"}
                        </span>
                      </div>
                      <span className="font-body text-[9px] text-muted-foreground">
                        {entry.timestamp.toLocaleTimeString("he-IL")}
                      </span>
                    </div>
                    <p
                      className="font-mono text-[10px] text-muted-foreground truncate"
                      dir="ltr"
                      style={{ textAlign: "left" }}
                    >
                      {entry.query.slice(0, 100)}
                      {entry.query.length > 100 ? "..." : ""}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setHistory([])}
                className="font-body text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                נקה היסטוריה
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevSettingsDialog;
