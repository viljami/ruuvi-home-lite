import type { TimeRange } from '../types/index.js';

export class TimeFormatter {
  static formatTimeLabel(timestamp: number, range: TimeRange): string {
    const date = new Date(timestamp * 1000);

    switch (range) {
      case "hour":
        return date.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
      case "day":
        return date.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
      case "week":
        return (
          date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }) +
          " " +
          date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
          })
        );
      case "month":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "year":
        return date.toLocaleDateString("en-US", { month: "short" });
      default:
        return date.toLocaleTimeString("en-US", { hour12: false });
    }
  }

  static formatAge(seconds: number): string {
    if (seconds <= 0) return "now";
    seconds = Math.round(seconds);

    // Show seconds until reaching 1 minute
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    
    // Show only minutes until reaching 1 hour
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    }
    
    // Show only hours until reaching 1 day
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
    
    // Show only days from here onwards
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}