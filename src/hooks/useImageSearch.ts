import { useState } from "react";
import { classifyImageOnDevice } from "@/utils/r2rModel";

// Classifies entirely on-device (see src/utils/r2rModel.ts) — no network
// call, no server to keep alive.
export const useImageSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = async (imageUri: string): Promise<string | null> => {
    setLoading(true);
    try {
      const predictions = await classifyImageOnDevice(imageUri);
      return predictions[0]?.label ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image processing failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { processImage, loading, error };
};
