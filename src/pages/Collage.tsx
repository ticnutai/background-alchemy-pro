import { useEffect } from "react";
import CollageBuilder from "@/components/CollageBuilder";

export default function Collage() {
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => { if (wasDark) document.documentElement.classList.add("dark"); };
  }, []);
  return <CollageBuilder />;
}
