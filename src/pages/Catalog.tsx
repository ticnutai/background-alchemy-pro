import { useEffect } from "react";
import CatalogBuilder from "@/components/CatalogBuilder";

export default function Catalog() {
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => { if (wasDark) document.documentElement.classList.add("dark"); };
  }, []);
  return <CatalogBuilder />;
}
