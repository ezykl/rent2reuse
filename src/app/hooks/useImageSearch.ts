import { useState } from "react";
import { R2R_MODEL } from "@/constant/api";

export const useImageSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = async (imageUri: string): Promise<string | null> => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "image.jpg",
      } as any);

      const response = await fetch(R2R_MODEL, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0]["Predicted Item"];
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image processing failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { processImage, loading, error };
};
