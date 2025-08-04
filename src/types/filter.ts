export interface SearchFilter {
  priceRange: {
    min: number | null;
    max: number | null;
  };
  condition: string[];
  location: string[];
}
