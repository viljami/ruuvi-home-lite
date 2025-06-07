import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SensorCard } from "../src/components/SensorCard";
import { TimeFormatter } from "../src/utils/TimeFormatter";
import type { SensorReadingWithAge } from "@ruuvi-home/shared";

describe("SensorCard", () => {
  let mockReading: SensorReadingWithAge;
  let mockSensorNames: Map<string, string>;
  let mockOnHover: ReturnType<typeof vi.fn>;
  let mockOnEditName: ReturnType<typeof vi.fn>;
  let colors: string[];

  beforeEach(() => {
    mockReading = {
      sensorMac: "AA:BB:CC:DD:EE:FF",
      temperature: 23.5,
      humidity: 45.2,
      timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute
      secondsAgo: 60,
    };

    mockSensorNames = new Map();
    mockOnHover = vi.fn();
    mockOnEditName = vi.fn();
    colors = ["#ff0000", "#00ff00", "#0000ff"];

    // Mock Date.now for consistent testing
    vi.spyOn(Date, "now").mockReturnValue(1000000000000); // Fixed timestamp
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create SensorCard with required properties", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      expect(card).toBeInstanceOf(HTMLElement);
      expect(card.getAttribute("data-sensor-mac")).toBe("AA:BB:CC:DD:EE:FF");
      expect(card.sensorColor).toBe("#ff0000");
      expect(card.displayName).toBe("DD:EE:FF");
      expect(card.isOffline).toBe(false);
    });
  });

  describe("sensorColor", () => {
    it("should return correct color based on sensor index", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 1,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.sensorColor).toBe("#00ff00");
    });

    it("should wrap around colors array", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 5,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.sensorColor).toBe("#0000ff"); // 5 % 3 = 2
    });
  });

  describe("displayName", () => {
    it("should return custom name when available", () => {
      mockSensorNames.set("AA:BB:CC:DD:EE:FF", "Living Room");
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.displayName).toBe("Living Room");
    });

    it("should return truncated MAC address when no custom name", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.displayName).toBe("DD:EE:FF");
    });
  });

  describe("isOffline", () => {
    it("should return false for recent readings", () => {
      mockReading.secondsAgo = 120; // 2 minutes
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.isOffline).toBe(false);
    });

    it("should return true for old readings", () => {
      mockReading.secondsAgo = 360; // 6 minutes
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.isOffline).toBe(true);
    });

    it("should calculate secondsAgo when not provided", () => {
      const readingWithoutSecondsAgo = {
        sensorMac: "AA:BB:CC:DD:EE:FF",
        temperature: 23.5,
        humidity: 45.2,
        timestamp: Math.floor(Date.now() / 1000) - 400, // 400 seconds
      } as SensorReadingWithAge;

      const card = new SensorCard({
        reading: readingWithoutSecondsAgo,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      expect(card.isOffline).toBe(true);
    });
  });

  describe("TimeFormatter.formatAge", () => {
    it("should format seconds correctly", () => {
      expect(TimeFormatter.formatAge(0)).toBe("");
      expect(TimeFormatter.formatAge(30)).toBe("");
      expect(TimeFormatter.formatAge(59)).toBe("");
    });

    it("should format minutes correctly", () => {
      expect(TimeFormatter.formatAge(60)).toBe("1m");
      expect(TimeFormatter.formatAge(120)).toBe("2m");
      expect(TimeFormatter.formatAge(3599)).toBe("59m");
    });

    it("should format hours correctly", () => {
      expect(TimeFormatter.formatAge(3600)).toBe("1h");
      expect(TimeFormatter.formatAge(7200)).toBe("2h");
      expect(TimeFormatter.formatAge(86399)).toBe("23h");
    });

    it("should format days correctly", () => {
      expect(TimeFormatter.formatAge(86400)).toBe("1d");
      expect(TimeFormatter.formatAge(172800)).toBe("2d");
    });

    it("should handle negative values", () => {
      expect(TimeFormatter.formatAge(-10)).toBe("");
    });
  });

  describe("rendering", () => {
    let card: SensorCard;

    beforeEach(() => {
      card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
    });

    it("should create element with correct structure", () => {
      expect(card.tagName).toBe("SENSOR-CARD");
      expect(card.className.trim()).toBe("sensor-item");
      expect(card.style.borderLeftColor).toBe("#ff0000");
    });

    it("should display temperature correctly", () => {
      const tempElement = card.querySelector(".sensor-temp");
      expect(tempElement?.textContent).toBe("23.5°C");
    });

    it("should display humidity when available", () => {
      const humidityElement = card.querySelector(".sensor-humidity");
      expect(humidityElement).toBeTruthy();
      expect(humidityElement?.textContent).toBe("45.2%");
    });

    it("should not display humidity when null", () => {
      const readingWithoutHumidity = { ...mockReading, humidity: null };
      const cardWithoutHumidity = new SensorCard({
        reading: readingWithoutHumidity,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      const humidityElement =
        cardWithoutHumidity.querySelector(".sensor-humidity");
      expect(humidityElement).toBeFalsy();
    });

    it("should display sensor MAC correctly", () => {
      const macElement = card.querySelector(".sensor-mac");
      expect(macElement?.textContent).toBe("DD:EE:FF");
    });

    it("should display age correctly", () => {
      const ageElement = card.querySelector(".sensor-age");
      expect(ageElement?.textContent).toBe("1m");
    });

    it("should add offline class when sensor is offline", () => {
      const offlineReading = { ...mockReading, secondsAgo: 400 };
      const offlineCard = new SensorCard({
        reading: offlineReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      expect(offlineCard.className).toContain("sensor-offline");
    });

    it("should make MAC clickable for admin users", () => {
      const adminCard = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: true,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      const macElement = adminCard.querySelector(".sensor-mac") as HTMLElement;

      expect(macElement.style.cursor).toBe("pointer");
      expect(macElement.style.textDecoration).toBe("underline");
    });

    it("should set data attribute with sensor MAC", () => {
      expect(card.getAttribute("data-sensor-mac")).toBe("AA:BB:CC:DD:EE:FF");
    });
  });

  describe("event handling", () => {
    let card: SensorCard;

    beforeEach(() => {
      card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: true,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
    });

    it("should call onHover when mouse enters", () => {
      const mouseEnterEvent = new Event("mouseenter");
      card.dispatchEvent(mouseEnterEvent);
      expect(mockOnHover).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
    });

    it("should call onHover with null when mouse leaves", () => {
      const mouseLeaveEvent = new Event("mouseleave");
      card.dispatchEvent(mouseLeaveEvent);
      expect(mockOnHover).toHaveBeenCalledWith(null);
    });

    it("should call onHover when touched", () => {
      const touchStartEvent = new Event("touchstart");
      card.dispatchEvent(touchStartEvent);
      expect(mockOnHover).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
    });

    it("should call onEditName when admin clicks MAC", () => {
      const macElement = card.querySelector(".sensor-mac") as HTMLElement;
      const clickEvent = new Event("click");

      macElement.dispatchEvent(clickEvent);
      expect(mockOnEditName).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
    });

    it("should not make MAC clickable for non-admin users", () => {
      const nonAdminCard = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
      const macElement = nonAdminCard.querySelector(
        ".sensor-mac",
      ) as HTMLElement;

      expect(macElement.style.cursor).not.toBe("pointer");
      expect(macElement.style.textDecoration).not.toBe("underline");
    });
  });

  describe("update", () => {
    let card: SensorCard;

    beforeEach(() => {
      card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });
    });

    it("should update temperature display", () => {
      const newReading = { ...mockReading, temperature: 25.0 };
      card.update({ reading: newReading });

      const tempElement = card.querySelector(".sensor-temp");
      expect(tempElement?.textContent).toBe("25.0°C");
    });

    it("should update humidity display", () => {
      const newReading = { ...mockReading, humidity: 50.0, temperature: 25.0 };
      card.update({ reading: newReading });

      const humidityElement = card.querySelector(".sensor-humidity");
      expect(humidityElement?.textContent).toBe("50.0%");
    });

    it("should add humidity element when it becomes available", () => {
      const readingWithoutHumidity = { ...mockReading, humidity: null };
      const cardNoHumidity = new SensorCard({
        reading: readingWithoutHumidity,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      expect(cardNoHumidity.querySelector(".sensor-humidity")).toBeFalsy();

      const newReading = { ...mockReading, humidity: 55.0, temperature: 25.0 };
      cardNoHumidity.update({ reading: newReading });

      const humidityElement = cardNoHumidity.querySelector(".sensor-humidity");
      expect(humidityElement).toBeTruthy();
      expect(humidityElement?.textContent).toBe("55.0%");
    });

    it("should remove humidity element when it becomes null", () => {
      expect(card.querySelector(".sensor-humidity")).toBeTruthy();

      const newReading = { ...mockReading, humidity: null, temperature: 25.0 };
      card.update({ reading: newReading });

      expect(card.querySelector(".sensor-humidity")).toBeFalsy();
    });

    it("should update age display", () => {
      const newReading = { ...mockReading, secondsAgo: 120 };
      card.update({ reading: newReading });

      const ageElement = card.querySelector(".sensor-age");
      expect(ageElement?.textContent).toBe("2m");
    });

    it("should update sensor name display", () => {
      const newSensorNames = new Map(mockSensorNames);
      newSensorNames.set("AA:BB:CC:DD:EE:FF", "Kitchen");
      const newReading = { ...mockReading, temperature: 25.0 };
      card.update({ sensorNames: newSensorNames, reading: newReading });

      const nameElement = card.querySelector(".sensor-mac");
      expect(nameElement?.textContent).toBe("Kitchen");
    });

    it("should update admin status", () => {
      const newReading = { ...mockReading, temperature: 25.0 };
      card.update({ isAdmin: true, reading: newReading });

      const macElement = card.querySelector(".sensor-mac") as HTMLElement;
      expect(macElement.style.cursor).toBe("pointer");
    });

    it("should update offline status", () => {
      const newReading = { ...mockReading, secondsAgo: 400 };
      card.update({ reading: newReading });

      expect(card.className).toContain("sensor-offline");
    });

    it("should handle pending updates during hover", () => {
      // Simulate hover state
      Object.defineProperty(card, "matches", {
        value: (selector: string) => selector === ":hover",
        configurable: true,
      });

      const newReading = { ...mockReading, temperature: 30.0 };
      card.update({ reading: newReading });

      // Should not update immediately
      const tempElement = card.querySelector(".sensor-temp");
      expect(tempElement?.textContent).toBe("23.5°C");
    });

    it("should skip update when no meaningful changes", () => {
      const renderSpy = vi.spyOn(card as any, "render");

      // Update with same values
      card.update({ reading: mockReading });

      // render should not be called again since values haven't changed
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should remove element from DOM", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      // Add to DOM for testing
      document.body.appendChild(card);
      expect(document.body.contains(card)).toBe(true);

      card.remove();
      expect(document.body.contains(card)).toBe(false);
    });

    it("should handle destroy when element is not in DOM", () => {
      const card = new SensorCard({
        reading: mockReading,
        sensorIndex: 0,
        colors: colors,
        sensorNames: mockSensorNames,
        isAdmin: false,
        onHover: mockOnHover,
        onEditName: mockOnEditName,
      });

      // Should not throw error when not in DOM
      expect(() => card.remove()).not.toThrow();
    });
  });
});
