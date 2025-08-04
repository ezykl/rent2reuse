import { useCallback } from "react";

export function useTimeConverter() {
  // Convert "hh:mm AM/PM" to minutes since midnight
  const timeToMinutes = useCallback((timeStr: string): number => {
    const [time, period] = timeStr.trim().split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (period.toUpperCase() === "PM" && hours !== 12) {
      hours += 12;
    }
    if (period.toUpperCase() === "AM" && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }, []);

  // Convert minutes since midnight to "hh:mm AM/PM"
  const minutesToTime = useCallback((totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

    const h = String(hours12).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");

    return `${h}:${m} ${period}`;
  }, []);

  return {
    timeToMinutes,
    minutesToTime,
  };
}
