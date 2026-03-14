import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2, ImagePlus, Trash2, Camera, ChevronDown, Eye, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 images attached to the message
  previewImage?: string; // AI-generated preview image
  previewPrompt?: string; // prompt used for preview generation
}

interface AIChatDialogProps {
  onApplyBackground: (prompt: string, name: string) => void;
  onEditWithImages?: (productImage: string, referenceImage: string, fidelity: string, elements: string) => void;
}

type FlowStep = "idle" | "upload-product" | "upload-reference" | "choose-fidelity" | "analyzing" | "choose-elements" | "ready";

const fidelityLevels = [
  { id: "free", label: "השראה חופשית", desc: "לוקח רק רעיון כללי מהתמונה", strength: "0.3", icon: "🎨" },
  { id: "similar", label: "דומה", desc: "צבעים וחומרים דומים", strength: "0.5", icon: "🔄" },
  { id: "accurate", label: "מדויק", desc: "שומר על פרטים ומרקם", strength: "0.75", icon: "🎯" },
  { id: "exact", label: "העתק מדויק", desc: "כמעט זהה לתמונת הייחוס", strength: "0.95", icon: "📋" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const AIChatDialog = ({ onApplyBackground, onEditWithImages }: AIChatDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "שלום! 👋 אני היועץ שלך לרקעים מקצועיים לצילום מוצרים.\n\nאתה יכול:\n• **לשאול אותי** על רקעים מתאימים למוצר שלך\n• **להעלות תמונת מוצר** ואנתח אותה ואציע רקעים\n• **להעלות תמונת ייחוס** לרקע שתרצה ואחיל אותו\n\nלחץ על 📷 כדי להתחיל!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Guided flow state
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [selectedFidelity, setSelectedFidelity] = useState("similar");
  const [suggestedElements, setSuggestedElements] = useState<string[]>([]);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseActions = useCallback(
    (content: string) => {
      const actionRegex = /\[ACTION:APPLY_BACKGROUND\](.*?)\[\/ACTION\]/g;
      const match = actionRegex.exec(content);
      if (match) {
        try {
          const action = JSON.parse(match[1]);
          if (action.prompt && action.name) {
            onApplyBackground(action.prompt, action.name);
          }
        } catch {}
      }

      // Parse element suggestions
      const elemRegex = /\[ELEMENTS\](.*?)\[\/ELEMENTS\]/g;
      const elemMatch = elemRegex.exec(content);
      if (elemMatch) {
        try {
          const elements = JSON.parse(elemMatch[1]);
          if (Array.isArray(elements)) {
            setSuggestedElements(elements);
            setFlowStep("choose-elements");
          }
        } catch {}
      }
    },
    [onApplyBackground]
  );

  const cleanContent = (content: string) => {
    return content
      .replace(/\[ACTION:APPLY_BACKGROUND\].*?\[\/ACTION\]/g, "")
      .replace(/\[ELEMENTS\].*?\[\/ELEMENTS\]/g, "")
      .trim();
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    setProductImage(base64);
    setFlowStep("upload-reference");

    // Send product image to AI for analysis
    const userMsg: Message = {
      role: "user",
      content: "העליתי תמונת מוצר. נתח אותה ותציע רקעים מתאימים.",
      images: [base64],
    };
    setMessages((prev) => [...prev, userMsg]);
    await sendToAI([...messages, userMsg], true);
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    setReferenceImage(base64);
    setPreviewUrl(base64);
    setFlowStep("choose-fidelity");

    const userMsg: Message = {
      role: "user",
      content: "העליתי תמונת ייחוס לרקע. נתח מה הרקע בתמונה הזו ותציע אילו אלמנטים אפשר להוסיף.",
      images: [base64],
    };
    setMessages((prev) => [...prev, userMsg]);
    await sendToAI([...messages, userMsg], true);
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);

    if (!productImage) {
      setProductImage(base64);
      setFlowStep("upload-reference");
      const userMsg: Message = {
        role: "user",
        content: "העליתי תמונת מוצר. נתח אותה ותציע רקעים מתאימים.",
        images: [base64],
      };
      setMessages((prev) => [...prev, userMsg]);
      await sendToAI([...messages, userMsg], true);
    } else if (!referenceImage) {
      setReferenceImage(base64);
      setPreviewUrl(base64);
      setFlowStep("choose-fidelity");
      const userMsg: Message = {
        role: "user",
        content: "העליתי תמונת ייחוס לרקע. נתח מה הרקע בתמונה ותציע אלמנטים.",
        images: [base64],
      };
      setMessages((prev) => [...prev, userMsg]);
      await sendToAI([...messages, userMsg], true);
    }
  };

  const sendToAI = async (allMessages: Message[], isAnalysis = false) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      // Convert messages to API format with image support
      const apiMessages = allMessages.map((m) => {
        if (m.images?.length) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content },
              ...m.images.map((img) => ({
                type: "image_url",
                image_url: { url: img },
              })),
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          analyzeImage: isAnalysis,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "שגיאה בחיבור ל-AI");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > 1) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) {
        parseActions(assistantSoFar);
        setAnalysisResult(assistantSoFar);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await sendToAI([...messages, userMsg]);
  }, [input, isLoading, messages]);

  const handleApplyWithFidelity = () => {
    if (!productImage || !referenceImage) return;

    const fidelity = fidelityLevels.find((f) => f.id === selectedFidelity);
    const elementsStr = selectedElements.join(", ");

    // Send final instruction to AI
    const instruction = `
בבקשה צור prompt מפורט להחלפת רקע בהתבסס על:
- תמונת הייחוס שהעליתי
- רמת דיוק: ${fidelity?.label} (${fidelity?.desc})
${selectedElements.length > 0 ? `- אלמנטים לשלב: ${elementsStr}` : ""}
תן לי את ה-prompt הטוב ביותר והחל אותו.
    `.trim();

    const userMsg: Message = { role: "user", content: instruction };
    setMessages((prev) => [...prev, userMsg]);
    setFlowStep("ready");

    if (onEditWithImages) {
      onEditWithImages(productImage, referenceImage, fidelity?.strength || "0.5", elementsStr);
    }

    sendToAI([...messages, userMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetFlow = () => {
    setFlowStep("idle");
    setProductImage(null);
    setReferenceImage(null);
    setSelectedFidelity("similar");
    setSuggestedElements([]);
    setSelectedElements([]);
    setPreviewUrl(null);
    setAnalysisResult("");
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg hover:brightness-110 transition-all hover:scale-105"
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col w-[420px] h-[650px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-display text-sm font-bold text-foreground">יועץ רקעים AI</span>
        </div>
        <div className="flex items-center gap-1">
          {(productImage || referenceImage) && (
            <button
              onClick={resetFlow}
              className="rounded-lg px-2 py-1 font-accent text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              התחל מחדש
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Image preview strip */}
      {(productImage || referenceImage) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30" dir="rtl">
          {productImage && (
            <div className="relative group">
              <img src={productImage} alt="מוצר" className="h-12 w-12 rounded-lg object-cover border border-border" />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-primary px-1 py-0.5 font-accent text-[7px] text-primary-foreground whitespace-nowrap">מוצר</span>
              <button
                onClick={() => { setProductImage(null); setFlowStep("idle"); }}
                className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-destructive-foreground" />
              </button>
            </div>
          )}
          {referenceImage && (
            <div className="relative group">
              <img src={referenceImage} alt="ייחוס" className="h-12 w-12 rounded-lg object-cover border border-gold/50" />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-gold px-1 py-0.5 font-accent text-[7px] text-gold-foreground whitespace-nowrap">ייחוס</span>
              <button
                onClick={() => { setReferenceImage(null); setPreviewUrl(null); setFlowStep("upload-reference"); }}
                className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-destructive-foreground" />
              </button>
            </div>
          )}
          {selectedFidelity && referenceImage && (
            <span className="mr-auto rounded-full bg-accent/10 px-2 py-0.5 font-accent text-[10px] text-accent-foreground">
              {fidelityLevels.find((f) => f.id === selectedFidelity)?.icon} {fidelityLevels.find((f) => f.id === selectedFidelity)?.label}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className="max-w-[85%] space-y-2">
              {/* Show attached images */}
              {msg.images?.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt=""
                  className="rounded-xl max-h-36 object-cover border border-border"
                />
              ))}
              <div
                className={`rounded-2xl px-4 py-2.5 font-body text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-li:my-0 prose-ul:my-1 prose-headings:my-1">
                    <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{cleanContent(msg.content)}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-end">
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Guided flow cards */}
        {flowStep === "upload-reference" && !isLoading && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-2">
            <p className="font-display text-xs font-bold text-foreground text-center">📷 העלה תמונת ייחוס לרקע</p>
            <p className="font-body text-[10px] text-muted-foreground text-center">
              העלה תמונה שממנה אקח את הרקע הרצוי, או המשך לשוחח
            </p>
            <button
              onClick={() => refFileInputRef.current?.click()}
              className="w-full rounded-lg bg-gold py-2 font-display text-xs font-semibold text-gold-foreground transition-all hover:brightness-110 flex items-center justify-center gap-2"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              העלה תמונת ייחוס
            </button>
          </div>
        )}

        {flowStep === "choose-fidelity" && !isLoading && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
            <p className="font-display text-xs font-bold text-foreground text-center">🎯 כמה מדויק לתמונת הייחוס?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {fidelityLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedFidelity(level.id)}
                  className={`rounded-lg border-2 p-2 text-center transition-all ${
                    selectedFidelity === level.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-base">{level.icon}</span>
                  <span className="block font-display text-[10px] font-bold text-foreground mt-0.5">{level.label}</span>
                  <span className="block font-body text-[8px] text-muted-foreground">{level.desc}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setFlowStep("choose-elements");
                // Ask AI about elements
                const msg: Message = {
                  role: "user",
                  content: `בחרתי רמת דיוק: ${fidelityLevels.find(f => f.id === selectedFidelity)?.label}. אילו אלמנטים אתה מציע להוסיף או לשנות ברקע? תן רשימה מפורטת.`,
                };
                setMessages((prev) => [...prev, msg]);
                sendToAI([...messages, msg], false);
              }}
              className="w-full rounded-lg bg-primary py-2 font-display text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              המשך →
            </button>
          </div>
        )}

        {flowStep === "choose-elements" && !isLoading && suggestedElements.length > 0 && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
            <p className="font-display text-xs font-bold text-foreground text-center">✨ בחר אלמנטים להוספה</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedElements.map((el, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    setSelectedElements((prev) =>
                      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
                    )
                  }
                  className={`rounded-full px-2.5 py-1 font-body text-[10px] transition-all ${
                    selectedElements.includes(el)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {el}
                </button>
              ))}
            </div>
          </div>
        )}

        {flowStep === "choose-elements" && !isLoading && (
          <div className="flex justify-center">
            <button
              onClick={handleApplyWithFidelity}
              className="rounded-xl bg-gradient-to-l from-gold to-primary px-6 py-2.5 font-display text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 hover:scale-105 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              החל רקע עכשיו!
            </button>
          </div>
        )}

        {/* Preview */}
        {previewUrl && flowStep !== "idle" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border-b border-border">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="font-accent text-[10px] text-muted-foreground">תצוגה מקדימה של הייחוס</span>
            </div>
            <img src={previewUrl} alt="preview" className="w-full max-h-40 object-cover" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3" dir="rtl">
        {/* Quick action buttons */}
        {flowStep === "idle" && !productImage && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                setFlowStep("upload-product");
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 font-accent text-[10px] font-semibold text-gold transition-colors hover:bg-gold/20"
            >
              <Camera className="h-3 w-3" />
              העלה מוצר
            </button>
            <button
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 font-accent text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <ImagePlus className="h-3 w-3" />
              העלה תמונה
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:text-primary hover:border-primary/50"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל אותי על רקעים, או בקש להחיל רקע..."
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none max-h-24"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInlineImageUpload}
        className="hidden"
      />
      <input
        ref={refFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReferenceUpload}
        className="hidden"
      />
    </div>
  );
};

export default AIChatDialog;
