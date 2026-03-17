import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";

const Tool = lazy(() => import("./pages/Tool.tsx"));
const Gallery = lazy(() => import("./pages/Gallery.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const Collage = lazy(() => import("./pages/Collage.tsx"));
const Workspace = lazy(() => import("./pages/Workspace.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    <span className="ml-3 text-muted-foreground">טוען...</span>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div dir="rtl">
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tool" element={<Tool />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/collage" element={<Collage />} />
            <Route path="/workspace" element={<Workspace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
