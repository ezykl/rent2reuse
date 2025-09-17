import { StyleSheet } from "react-native";

const calendarStyles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    backgroundColor: "#2563EB", // Primary color
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 12,
  },
  headerText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 1,
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  weekDayText: {
    color: "#64748B", // Secondary text
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
    flex: 1,
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  dayText: {
    color: "#1e293b", // Main text
    fontSize: 15,
    fontWeight: "500",
  },
  today: {
    backgroundColor: "#DBEAFE", // Light blue
  },
  todayText: {
    color: "#2563EB",
    fontWeight: "bold",
  },
  selectedDay: {
    backgroundColor: "#2563EB",
  },
  selectedDayText: {
    color: "#fff",
    fontWeight: "bold",
  },
  disabledDayText: {
    color: "#CBD5E1",
  },
});
export default calendarStyles;
