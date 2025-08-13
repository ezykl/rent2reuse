import { useMemo } from "react";

interface UseDateConverterResult {
  convertDate: (dateString: string) => Date | null;
  convertDates: (dateStrings: string[]) => (Date | null)[];
  isValidDateString: (dateString: string) => boolean;
}

export const useDateConverter = (): UseDateConverterResult => {
  const convertDate = useMemo(() => {
    return (dateString: string): Date | null => {
      if (!dateString || typeof dateString !== "string") {
        return null;
      }

      try {
        // Clean the input string
        const cleanedString = dateString.trim();

        // Parse the date string using Date constructor
        // The format "August 10, 2025" is naturally parseable by Date
        const parsedDate = new Date(cleanedString);

        // Check if the date is valid
        if (isNaN(parsedDate.getTime())) {
          return null;
        }

        return parsedDate;
      } catch (error) {
        console.warn("Error converting date string:", error);
        return null;
      }
    };
  }, []);

  const convertDates = useMemo(() => {
    return (dateStrings: string[]): (Date | null)[] => {
      return dateStrings.map((dateString) => convertDate(dateString));
    };
  }, [convertDate]);

  const isValidDateString = useMemo(() => {
    return (dateString: string): boolean => {
      return convertDate(dateString) !== null;
    };
  }, [convertDate]);

  return {
    convertDate,
    convertDates,
    isValidDateString,
  };
};
