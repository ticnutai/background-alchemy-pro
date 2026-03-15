import { useCallback } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
}

const ImageUploader = ({ onImageSelect }: ImageUploaderProps) => {
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("יש להעלות קובץ תמונה בלבד (PNG, JPG, WEBP)");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("גודל הקובץ חורג מ-10MB. נסה תמונה קטנה יותר.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageSelect(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card p-8 cursor-pointer transition-colors hover:border-primary hover:bg-secondary/50"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Upload className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-display text-base font-semibold text-foreground">
          גרור תמונה לכאן או לחץ להעלאה
        </p>
        <p className="mt-0.5 font-body text-xs text-muted-foreground">
          PNG, JPG, WEBP — עד 10MB
        </p>
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </label>
  );
};

export default ImageUploader;
