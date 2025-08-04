import { ReactNode } from "react";

export type AIResult = {
  label: ReactNode;
  "Predicted Item": string;
  Category: "Prohibited" | "Accepted" | "N/A";
  Confidence: string;
};

export type ToolCategory = {
  name: string;
  count: number;
  examples: string[];
};

export type CategoryMapping = {
  [key: string]: string;
};