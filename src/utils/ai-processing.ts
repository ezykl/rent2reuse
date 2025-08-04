import { AIResult } from "../types/ai-types";
import { ACCEPTED_CATEGORIES, ITEM_TO_CATEGORY_MAP, PROHIBITED_CATEGORIES } from "../constant/tool-categories";

export const processAIResult = (result: AIResult) => {
  const itemName = result["Predicted Item"];
  const confidence = parseFloat(result.Confidence.replace("%", ""));
  const isProhibited = result.Category === "Prohibited";
  const category = ITEM_TO_CATEGORY_MAP[itemName] || "Unknown";

  return {
    itemName,
    confidence,
    isProhibited,
    category,
    isUnknown: confidence < 20,
    isLowConfidence: confidence >= 20 && confidence < 70,
    isHighConfidence: confidence >= 70,
  };
};

export const getCategoryInfo = (itemName: string) => {
  const category = ITEM_TO_CATEGORY_MAP[itemName];
  if (!category) return null;

  return {
    category,
    examples: ACCEPTED_CATEGORIES.find(cat => cat.name === category)?.examples || [],
  };
};