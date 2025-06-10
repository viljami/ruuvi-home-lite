/**
 * DeviceHelper
 *
 * Simple utility for device detection and applying mobile-friendly optimizations
 */

import { Utils } from "../Utils";

export class DeviceHelper {
  // Device detection (calculated once on first access)
  private static _isIOS: boolean | null = null;
  private static _isAndroid: boolean | null = null;
  private static _isMobile: boolean | null = null;
  private static _isPWA: boolean | null = null;

  /**
   * Check if the current device is iOS (iPhone, iPad, iPod)
   */
  static get isIOS(): boolean {
    if (this._isIOS === null) {
      const windowWithMSStream = window as { MSStream?: unknown };
      this._isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !windowWithMSStream.MSStream;
    }
    return this._isIOS;
  }

  /**
   * Check if the current device is Android
   */
  static get isAndroid(): boolean {
    if (this._isAndroid === null) {
      this._isAndroid = /Android/.test(navigator.userAgent);
    }
    return this._isAndroid;
  }

  /**
   * Check if the current device is a mobile device
   */
  static get isMobile(): boolean {
    if (this._isMobile === null) {
      this._isMobile =
        this.isIOS ||
        this.isAndroid ||
        /Mobile|Tablet|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
    }
    return this._isMobile;
  }

  /**
   * Check if the app is running in PWA mode (standalone)
   */
  static get isPWA(): boolean {
    if (this._isPWA === null) {
      const navigatorWithStandalone = navigator as { standalone?: boolean };
      this._isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone === true;
    }
    return this._isPWA;
  }

  /**
   * Apply touch event handling for better mobile experience
   */
  static fixTouchEvents(element: HTMLElement): void {
    if (!element) return;

    // Remove tap highlight
    element.style.setProperty("-webkit-tap-highlight-color", "transparent");

    // Add touch feedback for interactive elements
    if (
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.classList.contains("btn") ||
      element.hasAttribute("data-clickable")
    ) {
      element.addEventListener(
        "touchstart",
        () => element.classList.add("touch-active"),
        { passive: true },
      );

      element.addEventListener(
        "touchend",
        () => setTimeout(() => element.classList.remove("touch-active"), 150),
        { passive: true },
      );

      element.addEventListener(
        "touchcancel",
        () => element.classList.remove("touch-active"),
        { passive: true },
      );
    }
  }

  /**
   * Apply touch events to all interactive elements in a container
   */
  static fixAllTouchEvents(
    container: HTMLElement = document.body,
    selector: string = "button, a, .btn, [data-clickable], sensor-card",
  ): void {
    if (container.matches(selector)) {
      this.fixTouchEvents(container);
    }

    container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      this.fixTouchEvents(el);
    });
  }

  /**
   * Apply all device-specific optimizations
   */
  static applyAllFixes(): void {
    // Add device classes to the body
    document.body.classList.toggle("ios-device", this.isIOS);
    document.body.classList.toggle("android-device", this.isAndroid);
    document.body.classList.toggle("mobile-device", this.isMobile);
    document.body.classList.toggle("pwa-mode", this.isPWA);

    // Set initial orientation class
    const orientation =
      window.innerHeight > window.innerWidth ? "portrait" : "landscape";
    document.body.classList.add(orientation);

    // Update orientation class when device orientation changes
    window.addEventListener(
      "orientationchange",
      Utils.debounce(() => {
        document.body.classList.remove("portrait", "landscape");
        document.body.classList.add(
          window.innerHeight > window.innerWidth ? "portrait" : "landscape",
        );
      }, 200),
    );

    // Apply iOS PWA fixes if needed
    if (this.isIOS && this.isPWA) {
      document.documentElement.style.height = `${window.innerHeight}px`;
      window.addEventListener("resize", () => {
        document.documentElement.style.height = `${window.innerHeight}px`;
      });
    }

    // Apply touch optimizations
    this.fixAllTouchEvents();
  }
}
