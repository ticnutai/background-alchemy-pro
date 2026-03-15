import { createContext, useContext, useReducer, useCallback, type ReactNode, type Dispatch } from "react";
import { type ImageAdjustments, defaultAdjustments } from "@/components/ImageAdjustmentsPanel";

// ─── State ───────────────────────────────────────────────────
interface HistoryEntry {
  resultImage: string | null;
  adjustments: ImageAdjustments;
  label: string;
}

interface ToolState {
  // Image state
  originalImage: string | null;
  resultImage: string | null;
  adjustments: ImageAdjustments;
  referenceImages: string[];

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Comparison / Before-After
  compareMode: "slider" | "side-by-side" | "fade" | "split";
  showComparison: boolean;
  comparisonImages: Array<{ image: string; label: string }>;

  // Processing state
  isProcessing: boolean;
  isEnhancing: boolean;
  isExporting: boolean;

  // Preset state
  selectedPreset: string | null;
  selectedPresetName: string | null;
  selectedPresetType: string | null;
  customPrompt: string;
  activePrompt: string;
  suggestedName: string | null;
  preciseMode: boolean;

  // UI state
  activeTab: "backgrounds" | "adjust" | "tools" | "export" | "smart" | "filters" | "crop" | "advanced";
  showMockup: boolean;
  showBatch: boolean;
  showHistory: boolean;
  showSocial: boolean;
  showShare: boolean;
  showDevSettings: boolean;

  // Multi-select state
  multiSelectMode: boolean;
  selectedPresetIds: string[];
  batchResults: Array<{ name: string; image: string; prompt: string }>;
  batchProcessing: boolean;
  batchProgress: { current: number; total: number };
}

export const initialToolState: ToolState = {
  originalImage: null,
  resultImage: null,
  adjustments: defaultAdjustments,
  referenceImages: [],
  undoStack: [],
  redoStack: [],
  compareMode: "slider",
  showComparison: false,
  comparisonImages: [],
  isProcessing: false,
  isEnhancing: false,
  isExporting: false,
  selectedPreset: null,
  selectedPresetName: null,
  selectedPresetType: null,
  customPrompt: "",
  activePrompt: "",
  suggestedName: null,
  preciseMode: false,
  activeTab: "backgrounds",
  showMockup: false,
  showBatch: false,
  showHistory: false,
  showSocial: false,
  showShare: false,
  showDevSettings: false,
  multiSelectMode: false,
  selectedPresetIds: [],
  batchResults: [],
  batchProcessing: false,
  batchProgress: { current: 0, total: 0 },
};

// ─── Actions ─────────────────────────────────────────────────
type ToolAction =
  | { type: "SET_ORIGINAL_IMAGE"; payload: string | null }
  | { type: "SET_RESULT_IMAGE"; payload: string | null }
  | { type: "SET_ADJUSTMENTS"; payload: ImageAdjustments }
  | { type: "RESET_ADJUSTMENTS" }
  | { type: "SET_REFERENCE_IMAGES"; payload: string[] }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_ENHANCING"; payload: boolean }
  | { type: "SET_EXPORTING"; payload: boolean }
  | { type: "SELECT_PRESET"; payload: { id: string; prompt: string; name: string; type: string | null } }
  | { type: "SET_CUSTOM_PROMPT"; payload: string }
  | { type: "SET_ACTIVE_PROMPT"; payload: string }
  | { type: "SET_SUGGESTED_NAME"; payload: string | null }
  | { type: "SET_PRECISE_MODE"; payload: boolean }
  | { type: "SET_ACTIVE_TAB"; payload: ToolState["activeTab"] }
  | { type: "TOGGLE_MODAL"; payload: { modal: "mockup" | "batch" | "history" | "social" | "share" | "devSettings"; value: boolean } }
  | { type: "SET_MULTI_SELECT_MODE"; payload: boolean }
  | { type: "TOGGLE_PRESET_ID"; payload: string }
  | { type: "SET_BATCH_RESULTS"; payload: ToolState["batchResults"] }
  | { type: "SET_BATCH_PROCESSING"; payload: boolean }
  | { type: "SET_BATCH_PROGRESS"; payload: { current: number; total: number } }
  | { type: "RESET_IMAGE" }
  | { type: "APPLY_BACKGROUND"; payload: { prompt: string; name: string } }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_COMPARE_MODE"; payload: ToolState["compareMode"] }
  | { type: "TOGGLE_COMPARISON"; payload: boolean }
  | { type: "ADD_COMPARISON_IMAGE"; payload: { image: string; label: string } }
  | { type: "CLEAR_COMPARISON" };

function toolReducer(state: ToolState, action: ToolAction): ToolState {
  switch (action.type) {
    case "SET_ORIGINAL_IMAGE":
      return { ...state, originalImage: action.payload, resultImage: null, adjustments: defaultAdjustments };
    case "SET_RESULT_IMAGE": {
      // Push current state to undo stack when a new result arrives
      const entry: HistoryEntry = {
        resultImage: state.resultImage,
        adjustments: state.adjustments,
        label: state.selectedPresetName || state.customPrompt.slice(0, 30) || "שינוי",
      };
      const newUndo = state.resultImage !== null
        ? [...state.undoStack, entry].slice(-20)
        : state.undoStack;
      return { ...state, resultImage: action.payload, undoStack: newUndo, redoStack: [] };
    }
    case "SET_ADJUSTMENTS":
      return { ...state, adjustments: action.payload };
    case "RESET_ADJUSTMENTS":
      return { ...state, adjustments: defaultAdjustments };
    case "SET_REFERENCE_IMAGES":
      return { ...state, referenceImages: action.payload };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "SET_ENHANCING":
      return { ...state, isEnhancing: action.payload };
    case "SET_EXPORTING":
      return { ...state, isExporting: action.payload };
    case "SELECT_PRESET":
      return {
        ...state,
        selectedPreset: action.payload.id,
        activePrompt: action.payload.prompt,
        customPrompt: "",
        referenceImages: [],
        selectedPresetName: action.payload.name,
        selectedPresetType: action.payload.type,
        suggestedName: null,
      };
    case "SET_CUSTOM_PROMPT":
      return {
        ...state,
        customPrompt: action.payload,
        ...(action.payload.trim() ? { selectedPreset: null, selectedPresetName: null, selectedPresetType: null } : {}),
      };
    case "SET_ACTIVE_PROMPT":
      return { ...state, activePrompt: action.payload };
    case "SET_SUGGESTED_NAME":
      return { ...state, suggestedName: action.payload };
    case "SET_PRECISE_MODE":
      return { ...state, preciseMode: action.payload };
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };
    case "TOGGLE_MODAL": {
      const key = `show${action.payload.modal.charAt(0).toUpperCase() + action.payload.modal.slice(1)}` as keyof ToolState;
      return { ...state, [key]: action.payload.value };
    }
    case "SET_MULTI_SELECT_MODE":
      return { ...state, multiSelectMode: action.payload, selectedPresetIds: [], batchResults: [] };
    case "TOGGLE_PRESET_ID": {
      const ids = state.selectedPresetIds.includes(action.payload)
        ? state.selectedPresetIds.filter((id) => id !== action.payload)
        : [...state.selectedPresetIds, action.payload];
      return { ...state, selectedPresetIds: ids };
    }
    case "SET_BATCH_RESULTS":
      return { ...state, batchResults: action.payload };
    case "SET_BATCH_PROCESSING":
      return { ...state, batchProcessing: action.payload };
    case "SET_BATCH_PROGRESS":
      return { ...state, batchProgress: action.payload };
    case "RESET_IMAGE":
      return { ...state, originalImage: null, resultImage: null, adjustments: defaultAdjustments, undoStack: [], redoStack: [] };
    case "APPLY_BACKGROUND":
      return {
        ...state,
        customPrompt: action.payload.prompt,
        activePrompt: action.payload.prompt,
        selectedPreset: null,
        selectedPresetName: action.payload.name,
        suggestedName: action.payload.name,
      };
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const redoEntry: HistoryEntry = {
        resultImage: state.resultImage,
        adjustments: state.adjustments,
        label: state.selectedPresetName || "נוכחי",
      };
      return {
        ...state,
        resultImage: prev.resultImage,
        adjustments: prev.adjustments,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, redoEntry],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const undoEntry: HistoryEntry = {
        resultImage: state.resultImage,
        adjustments: state.adjustments,
        label: state.selectedPresetName || "נוכחי",
      };
      return {
        ...state,
        resultImage: next.resultImage,
        adjustments: next.adjustments,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, undoEntry],
      };
    }
    case "SET_COMPARE_MODE":
      return { ...state, compareMode: action.payload };
    case "TOGGLE_COMPARISON":
      return { ...state, showComparison: action.payload };
    case "ADD_COMPARISON_IMAGE":
      return { ...state, comparisonImages: [...state.comparisonImages, action.payload].slice(-10) };
    case "CLEAR_COMPARISON":
      return { ...state, comparisonImages: [] };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
const ToolStateContext = createContext<ToolState | null>(null);
const ToolDispatchContext = createContext<Dispatch<ToolAction> | null>(null);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toolReducer, initialToolState);
  return (
    <ToolStateContext.Provider value={state}>
      <ToolDispatchContext.Provider value={dispatch}>
        {children}
      </ToolDispatchContext.Provider>
    </ToolStateContext.Provider>
  );
}

export function useToolState() {
  const ctx = useContext(ToolStateContext);
  if (!ctx) throw new Error("useToolState must be used within ToolProvider");
  return ctx;
}

export function useToolDispatch() {
  const ctx = useContext(ToolDispatchContext);
  if (!ctx) throw new Error("useToolDispatch must be used within ToolProvider");
  return ctx;
}
