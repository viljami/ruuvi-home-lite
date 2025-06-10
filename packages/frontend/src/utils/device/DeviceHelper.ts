/**
 * DeviceHelper
 *
 * Lightweight utility for device detection and adding appropriate CSS classes
 * to enable CSS-first responsive design approach.
 */

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
      // MSStream is a property present in IE/Edge but not in iOS
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
      // Safari iOS-specific standalone property
      const navigatorWithStandalone = navigator as { standalone?: boolean };
      this._isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone === true;
    }
    return this._isPWA;
  }

  /**
   * Fix touch event handling for interactive elements (simplified)
   * @param element Element to apply touch event fixes to
   */
  static fixTouchEvents(element: HTMLElement): void {
    if (!element) return;

    // Add -webkit-tap-highlight-color
    (
      element.style as CSSStyleDeclaration & { webkitTapHighlightColor: string }
    ).webkitTapHighlightColor = "transparent";

    // For clickable elements, add simple touch feedback via CSS class
    if (
      element.hasAttribute("data-clickable") ||
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.classList.contains("btn") ||
      element.classList.contains("sensor-item")
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
   * Fix all touch events for a container and its children
   * @param container Container element
   * @param selector CSS selector to filter which elements to fix
   */
  static fixAllTouchEvents(
    container: HTMLElement = document.body,
    selector: string = "[data-clickable], button, a, .btn, .sensor-item",
  ): void {
    // Fix the container if it matches
    if (container.matches(selector)) {
      this.fixTouchEvents(container);
    }

    // Fix all matching elements inside the container
    container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      this.fixTouchEvents(el);
    });
  }

  /**
   * Apply device detection and add appropriate CSS classes to enable
   * responsive CSS-first design approach
   */
  static applyAllFixes(): void {
    // Add device classes to the body for CSS targeting
    document.body.classList.toggle("ios-device", this.isIOS);
    document.body.classList.toggle("android-device", this.isAndroid);
    document.body.classList.toggle("mobile-device", this.isMobile);
    document.body.classList.toggle("pwa-mode", this.isPWA);

    // Add orientation class
    const orientation =
      window.innerHeight > window.innerWidth ? "portrait" : "landscape";
    document.body.classList.add(orientation);

    // Listen to orientation changes to update classes
    window.addEventListener("orientationchange", () => {
      // Update orientation class after orientation change
      setTimeout(
        () => {
          document.body.classList.remove("portrait", "landscape");
          document.body.classList.add(
            window.innerHeight > window.innerWidth ? "portrait" : "landscape",
          );
        },
        this.isIOS ? 300 : 100,
      );
    });

    // Fix iOS PWA height for fullscreen apps
    if (this.isIOS && this.isPWA) {
      document.documentElement.style.height = `${window.innerHeight}px`;
      window.addEventListener("resize", () => {
        document.documentElement.style.height = `${window.innerHeight}px`;
      });
    }

    // Add simple touch event handling
    this.fixAllTouchEvents();
  }
}
