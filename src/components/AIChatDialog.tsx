import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2, ImagePlus, Trash2, Camera, ChevronDown, Eye, Wand2, Check, XCircle, Plus, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

interface ColorSwatch {
  hex: string;
  name: string;
}

interface VisualOption {
  prompt: string;
  label: string;
  previewUrl?: string;
  isGenerating?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 images attached to the message
  previewImage?: string; // AI-generated preview image
  previewPrompt?: string; // prompt used for preview generation
  quickReplies?: QuickReply[]; // yes/no or option buttons
  colorPalette?: ColorSwatch[];
  visualOptions?: VisualOption[];
}

interface QuickReply {
  label: string;
  value: string;
  icon?: string;
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
const PREVIEW_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chat-preview`;

const AIChatDialog = ({ onApplyBackground, onEditWithImages }: AIChatDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "שלום! 👋 אני היועץ שלך לרקעים מקצועיים לצילום מוצרים.\n\nבוא נתחיל! ספר לי:\n\n1. **מה המוצר שלך?** (תכשיט, קוסמטיקה, מזון, יודאיקה...)\n2. **יש לך תמונה?** לחץ על 📷 כדי להעלות ואנתח אותה\n\nככל שתספר יותר, כך אוכל להציע רקע שבאמת מתאים! ✨",
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
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedFidelity, setSelectedFidelity] = useState("similar");
  const [suggestedElements, setSuggestedElements] = useState<string[]>([]);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [lastSuggestedPrompt, setLastSuggestedPrompt] = useState<{prompt: string; name: string} | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{id: string; url: string; name: string | null}>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const loadGalleryImages = async () => {
    setGalleryLoading(true);
    const { data } = await supabase
      .from("processing_history")
      .select("id, result_image_url, background_name, original_image_url")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      const imgs: Array<{id: string; url: string; name: string | null; type: string}> = [];
      data.forEach(item => {
        imgs.push({ id: item.id + "-result", url: item.result_image_url, name: item.background_name, type: "result" });
        imgs.push({ id: item.id + "-orig", url: item.original_image_url, name: "מקור", type: "original" });
      });
      // Deduplicate by url
      const seen = new Set<string>();
      setGalleryImages(imgs.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; }));
    }
    setGalleryLoading(false);
  };

  const handleGallerySelect = async (url: string) => {
    setShowGalleryPicker(false);
    // Fetch image and convert to base64
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      if (!productImage) {
        setProductImage(base64);
        setFlowStep("upload-reference");
        const userMsg: Message = {
          role: "user",
          content: "בחרתי תמונת מוצר מהגלריה. נתח אותה ותציע רקעים מתאימים.",
          images: [base64],
        };
        setMessages((prev) => [...prev, userMsg]);
        await sendToAI([...messages, userMsg], true);
      } else {
        setReferenceImages(prev => [...prev, base64]);
        setPreviewUrl(base64);
        setFlowStep("choose-fidelity");
        const userMsg: Message = {
          role: "user",
          content: "בחרתי תמונת ייחוס מהגלריה. נתח מה הרקע ותציע אלמנטים.",
          images: [base64],
        };
        setMessages((prev) => [...prev, userMsg]);
        await sendToAI([...messages, userMsg], true);
      }
    } catch {
      toast({ title: "שגיאה", description: "לא הצלחתי לטעון את התמונה", variant: "destructive" });
    }
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractTaggedContent = useCallback((content: string, tag: string) => {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\[\\s*${escapedTag}\\s*\\]([\\s\\S]*?)(?:\\[\\s*\\/\\s*${escapedTag}\\s*\\]|$)`, "i");
    const match = content.match(regex);
    return match?.[1]?.trim() || null;
  }, []);

  const stripTaggedContent = useCallback((content: string, tag: string) => {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\[\\s*${escapedTag}\\s*\\][\\s\\S]*?(?:\\[\\s*\\/\\s*${escapedTag}\\s*\\]|$)`, "gi");
    return content.replace(regex, "");
  }, []);

  const parseQuickReplies = useCallback((rawContent: string): QuickReply[] | undefined => {
    const normalized = rawContent.replace(/```json|```/gi, "").trim();

    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((item): item is QuickReply =>
            Boolean(item && typeof item === "object" && "label" in item && "value" in item)
          )
          .map((item) => ({ label: String(item.label), value: String(item.value), icon: item.icon }));
        if (valid.length) return valid;
      }
    } catch {
      // fallback parser below
    }

    const fallback: QuickReply[] = [];
    const pairRegex = /["']label["']\s*:\s*["']([^"']+)["'][\s\S]*?["']value["']\s*:\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = pairRegex.exec(normalized)) !== null) {
      fallback.push({ label: match[1].trim(), value: match[2].trim() });
    }

    return fallback.length ? fallback.slice(0, 6) : undefined;
  }, []);

  const parseActions = useCallback(
    (content: string) => {
      const actionRaw = extractTaggedContent(content, "ACTION:APPLY_BACKGROUND");
      if (actionRaw) {
        try {
          const actionJson = actionRaw.match(/\{[\s\S]*\}/)?.[0] ?? actionRaw;
          const action = JSON.parse(actionJson);
          if (action.prompt && action.name) {
            setLastSuggestedPrompt({ prompt: action.prompt, name: action.name });
          }
        } catch {
          // ignore malformed action block
        }
      }

      const elementsRaw = extractTaggedContent(content, "ELEMENTS");
      if (elementsRaw) {
        try {
          const elementsJson = elementsRaw.match(/\[[\s\S]*\]/)?.[0] ?? elementsRaw;
          const elements = JSON.parse(elementsJson);
          if (Array.isArray(elements)) {
            setSuggestedElements(elements.map((el) => String(el)));
            setFlowStep("choose-elements");
          }
        } catch {
          // ignore malformed elements block
        }
      }

      let quickReplies: QuickReply[] | undefined;
      const quickRepliesRaw = extractTaggedContent(content, "QUICK_REPLIES");
      if (quickRepliesRaw) {
        quickReplies = parseQuickReplies(quickRepliesRaw);
      }

      const yesNoRaw = extractTaggedContent(content, "YES_NO");
      if (yesNoRaw && !quickReplies?.length) {
        quickReplies = [
          { label: "✅ כן", value: `כן, ${yesNoRaw}` },
          { label: "❌ לא", value: `לא, ${yesNoRaw}` },
        ];
      }

      return quickReplies;
    },
    [extractTaggedContent, parseQuickReplies]
  );

  const generatePreview = async (prompt: string, msgIndex?: number) => {
    setIsGeneratingPreview(true);
    try {
      const resp = await fetch(PREVIEW_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          productImage: productImage || undefined,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "שגיאה ביצירת תצוגה מקדימה");
      }

      const data = await resp.json();
      
      if (data.image) {
        // Add preview as a message with the generated image
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "🖼️ **תצוגה מקדימה של הרקע:**",
            previewImage: data.image,
            previewPrompt: prompt,
          },
        ]);
        setPreviewUrl(data.image);
      } else {
        toast({
          title: "לא הצלחתי ליצור תצוגה מקדימה",
          description: data.text || "נסה שוב עם תיאור אחר",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const cleanContent = (content: string) => {
    let cleaned = content;
    ["ACTION:APPLY_BACKGROUND", "ELEMENTS", "QUICK_REPLIES", "YES_NO"].forEach((tag) => {
      cleaned = stripTaggedContent(cleaned, tag);
    });
    return cleaned.trim();
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
    const files = e.target.files;
    if (!files?.length) return;
    
    const newImages: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      newImages.push(await toBase64(files[i]));
    }
    
    setReferenceImages(prev => [...prev, ...newImages]);
    setPreviewUrl(newImages[0]);
    setFlowStep("choose-fidelity");

    const userMsg: Message = {
      role: "user",
      content: `העליתי ${newImages.length} תמונות ייחוס לרקע. נתח מה הרקע בתמונות ותציע אילו אלמנטים אפשר להוסיף.`,
      images: newImages,
    };
    setMessages((prev) => [...prev, userMsg]);
    await sendToAI([...messages, userMsg], true);
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    
    const newImages: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      newImages.push(await toBase64(files[i]));
    }

    if (!productImage) {
      setProductImage(newImages[0]);
      setFlowStep("upload-reference");
      const userMsg: Message = {
        role: "user",
        content: "העליתי תמונת מוצר. נתח אותה ותציע רקעים מתאימים.",
        images: [newImages[0]],
      };
      setMessages((prev) => [...prev, userMsg]);
      await sendToAI([...messages, userMsg], true);
    } else {
      // Additional images go to reference
      setReferenceImages(prev => [...prev, ...newImages]);
      setPreviewUrl(newImages[0]);
      setFlowStep("choose-fidelity");
      const userMsg: Message = {
        role: "user",
        content: `העליתי ${newImages.length} תמונות ייחוס לרקע. נתח מה הרקע בתמונות ותציע אלמנטים.`,
        images: newImages,
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
        const quickReplies = parseActions(assistantSoFar);
        setAnalysisResult(assistantSoFar);
        if (quickReplies?.length) {
          // Add quick replies to the last assistant message
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === "assistant") {
              updated[lastIdx] = { ...updated[lastIdx], quickReplies };
            }
            return updated;
          });
        }
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
    if (!productImage || referenceImages.length === 0) return;

    const fidelity = fidelityLevels.find((f) => f.id === selectedFidelity);
    const elementsStr = selectedElements.join(", ");

    const instruction = `
בבקשה צור prompt מפורט להחלפת רקע בהתבסס על:
- ${referenceImages.length} תמונות ייחוס שהעליתי
- רמת דיוק: ${fidelity?.label} (${fidelity?.desc})
${selectedElements.length > 0 ? `- אלמנטים לשלב: ${elementsStr}` : ""}
תן לי את ה-prompt הטוב ביותר והחל אותו.
    `.trim();

    const userMsg: Message = { role: "user", content: instruction };
    setMessages((prev) => [...prev, userMsg]);
    setFlowStep("ready");

    if (onEditWithImages) {
      onEditWithImages(productImage, referenceImages[0], fidelity?.strength || "0.5", elementsStr);
    }

    sendToAI([...messages, userMsg]);
  };

  const canApplyAnytime =
    !!lastSuggestedPrompt || (!!onEditWithImages && !!productImage && referenceImages.length > 0);

  const handlePersistentApply = () => {
    if (lastSuggestedPrompt) {
      onApplyBackground(lastSuggestedPrompt.prompt, lastSuggestedPrompt.name);
      toast({
        title: "הרקע הוגדר לעריכה",
        description: `השתמשתי בהצעה האחרונה: ${lastSuggestedPrompt.name}`,
      });
      return;
    }

    if (onEditWithImages && productImage && referenceImages.length > 0) {
      const fidelity = fidelityLevels.find((f) => f.id === selectedFidelity);
      onEditWithImages(productImage, referenceImages[0], fidelity?.strength || "0.5", selectedElements.join(", "));
      toast({
        title: "העריכה הופעלה",
        description: "הפעלתי עריכה לפי תמונת המוצר ותמונת הייחוס.",
      });
      return;
    }

    toast({
      title: "עדיין אין רקע מוכן להחלה",
      description: "בחר הצעת AI או העלה תמונת ייחוס, ואז לחץ שוב.",
      variant: "destructive",
    });
  };

  const handleQuickReply = async (value: string) => {
    const userMsg: Message = { role: "user", content: value };
    setMessages((prev) => [...prev, userMsg]);
    await sendToAI([...messages, userMsg]);
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
    setReferenceImages([]);
    setSelectedFidelity("similar");
    setSuggestedElements([]);
    setSelectedElements([]);
    setPreviewUrl(null);
    setAnalysisResult("");
    setLastSuggestedPrompt(null);
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
          {(productImage || referenceImages.length > 0) && (
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
      {(productImage || referenceImages.length > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30 overflow-x-auto" dir="rtl">
          {productImage && (
            <div className="relative group shrink-0">
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
          {referenceImages.map((img, idx) => (
            <div key={idx} className="relative group shrink-0">
              <img src={img} alt={`ייחוס ${idx + 1}`} className="h-12 w-12 rounded-lg object-cover border border-gold/50" />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-gold px-1 py-0.5 font-accent text-[7px] text-gold-foreground whitespace-nowrap">ייחוס {idx + 1}</span>
              <button
                onClick={() => {
                  setReferenceImages(prev => prev.filter((_, i) => i !== idx));
                  if (referenceImages.length <= 1) { setPreviewUrl(null); setFlowStep("upload-reference"); }
                }}
                className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-destructive-foreground" />
              </button>
            </div>
          ))}
          {referenceImages.length > 0 && (
            <button
              onClick={() => refFileInputRef.current?.click()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-gold/30 text-gold/50 hover:border-gold hover:text-gold transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {selectedFidelity && referenceImages.length > 0 && (
            <span className="mr-auto rounded-full bg-accent/10 px-2 py-0.5 font-accent text-[10px] text-accent-foreground shrink-0">
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

              {/* AI-generated preview image */}
              {msg.previewImage && (
                <div className="rounded-xl border border-primary/30 overflow-hidden">
                  <img src={msg.previewImage} alt="תצוגה מקדימה" className="w-full max-h-48 object-cover" />
                  <div className="flex items-center gap-1.5 p-2 bg-secondary/50">
                    <button
                      onClick={() => {
                        if (msg.previewPrompt) {
                          onApplyBackground(msg.previewPrompt, "רקע מותאם אישית");
                        }
                      }}
                      className="flex-1 rounded-lg bg-primary py-1.5 font-display text-[11px] font-bold text-primary-foreground hover:brightness-110 transition-all flex items-center justify-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      החל רקע זה
                    </button>
                    <button
                      onClick={() => generatePreview(msg.previewPrompt || "", i)}
                      disabled={isGeneratingPreview}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 font-accent text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      🔄 חדש
                    </button>
                  </div>
                </div>
              )}

              {/* Quick reply buttons - vertical numbered list */}
              {msg.quickReplies && msg.quickReplies.length > 0 && i === messages.length - 1 && !isLoading && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {msg.quickReplies.map((qr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickReply(qr.value)}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-right font-body text-xs text-foreground transition-all hover:bg-primary/10 hover:border-primary/40 active:scale-[0.98]"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[10px] font-bold text-primary">
                        {idx + 1}
                      </span>
                      <span>{qr.label}</span>
                    </button>
                  ))}
                </div>
              )}
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

        {/* Generating preview indicator */}
        {isGeneratingPreview && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-display text-xs text-primary">מייצר תצוגה מקדימה...</span>
          </div>
        )}

        {/* Preview generation button - appears when AI suggests a background */}
        {lastSuggestedPrompt && !isLoading && !isGeneratingPreview && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="font-display text-xs font-bold text-foreground text-center">🖼️ רוצה לראות תצוגה מקדימה?</p>
            <p className="font-body text-[10px] text-muted-foreground text-center">
              {lastSuggestedPrompt.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => generatePreview(lastSuggestedPrompt.prompt)}
                className="flex-1 rounded-lg bg-secondary py-2 font-display text-xs font-semibold text-foreground transition-all hover:bg-secondary/70 flex items-center justify-center gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" />
                צפה בתצוגה מקדימה
              </button>
              <button
                onClick={() => {
                  onApplyBackground(lastSuggestedPrompt.prompt, lastSuggestedPrompt.name);
                  setLastSuggestedPrompt(null);
                }}
                className="flex-1 rounded-lg bg-primary py-2 font-display text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                החל ישירות
              </button>
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
        <div className="mb-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <button
            onClick={handlePersistentApply}
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-2 font-display text-xs font-bold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            החל רקע עכשיו
          </button>
          <p className="mt-1 text-center font-body text-[10px] text-muted-foreground">
            {canApplyAnytime
              ? "זמין — לוחצים והעריכה מופעלת מיד"
              : "זמין תמיד: קודם בחר הצעת AI או העלה תמונת ייחוס"}
          </p>
        </div>

        {/* Quick action buttons */}
        {flowStep === "idle" && !productImage && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            <button
              onClick={() => { setShowGalleryPicker(true); loadGalleryImages(); }}
              className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 font-accent text-[10px] font-semibold text-accent-foreground transition-colors hover:bg-accent/20"
            >
              <FolderOpen className="h-3 w-3" />
              מהגלריה שלי
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
          <button
            onClick={() => { setShowGalleryPicker(true); loadGalleryImages(); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:text-accent-foreground hover:border-accent/50"
            title="בחר מהגלריה"
          >
            <FolderOpen className="h-4 w-4" />
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
        multiple
        onChange={handleInlineImageUpload}
        className="hidden"
      />
      <input
        ref={refFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleReferenceUpload}
        className="hidden"
      />

      {/* Gallery Picker Modal */}
      {showGalleryPicker && (
        <div className="absolute inset-0 z-50 flex flex-col bg-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-bold text-foreground">בחר מהגלריה</span>
            </div>
            <button onClick={() => setShowGalleryPicker(false)} className="rounded-lg p-1 hover:bg-secondary transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3" dir="rtl">
            {galleryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-body text-sm text-muted-foreground">אין תמונות בגלריה עדיין</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleGallerySelect(img.url)}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all"
                  >
                    <img src={img.url} alt={img.name || ""} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    {img.name && (
                      <span className="absolute bottom-0 inset-x-0 bg-foreground/60 backdrop-blur-sm px-1.5 py-0.5 font-accent text-[8px] text-card truncate">
                        {img.name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatDialog;
