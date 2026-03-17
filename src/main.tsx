import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTelemetry } from "@/lib/telemetry";

initTelemetry();

createRoot(document.getElementById("root")!).render(<App />);
