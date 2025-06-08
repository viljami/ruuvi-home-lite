import type { TimeRange } from "../types/index.js";

export class TimeFormatter {
  static formatTimeLabel(timestamp: number, range: TimeRange): string {
    const date = new Date(timestamp * 1000);

    switch (range) {
      case "hour":
        // Format as HH:MM with clean 10-minute intervals
        // Already aligned to 10-minute intervals from the chart calculation
        return date.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
      case "day":
        // Format as HH:00 for 3-hour intervals
        return (
          date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
          }) + ":00"
        );
      case "week":
        // Format as Day 12:00 for noon labels
        return (
          date.toLocaleDateString("en-US", {
            weekday: "short",
          }) + " 12:00"
        );
      case "month":
        // Format as Month Day for 5-day intervals
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "year":
        // Format as Month 1 for first of each month
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      default:
        return date.toLocaleTimeString("en-US", { hour12: false });
    }
  }

  static formatAge(seconds: number): string {
    if (seconds < 60) return "";
    seconds = Math.round(seconds);

    // Show only minutes until reaching 1 hour
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`;
    }

    // Show only hours until reaching 1 day
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h`;
    }

    // Show only days from here onwards
    return `${Math.floor(seconds / 86400)}d`;
  }
}
