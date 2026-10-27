export interface RangeSliderOptions {
  root: HTMLElement;
  fill: HTMLElement;
  minHandle: HTMLElement;
  maxHandle: HTMLElement;
  output: HTMLElement;
  min: number;
  max: number;
  step: number;
  pageStep: number;
  decimals: number;
  low: number;
  high: number;
  formatRange: (low: number, high: number) => string;
  valueText: (value: string, label: "minimum" | "maximum") => string;
  /** Called after the user changes a value (not on initial render). */
  onChange?: () => void;
}

/** Shared settings for the 0–20 star sliders. */
export const STAR_SLIDER = {
  min: 0,
  max: 20,
  step: 0.1,
  pageStep: 1,
  decimals: 1,
  formatRange: (low: number, high: number) =>
    `${low.toFixed(1)} - ${high.toFixed(1)} STARS`,
  valueText: (value: string, label: string) => `${value} stars ${label}`,
} satisfies Partial<RangeSliderOptions>;

/** Accessible two-handle range slider (pointer + keyboard). */
export class RangeSlider {
  low: number;
  high: number;
  private activeHandle: HTMLElement | null = null;
  private activePointerId: number | null = null;

  constructor(private readonly o: RangeSliderOptions) {
    this.low = o.low;
    this.high = o.high;
    o.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    o.root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    o.root.addEventListener("pointerup", (e) => this.endDrag(e));
    o.root.addEventListener("pointercancel", (e) => this.endDrag(e));
    for (const handle of [o.minHandle, o.maxHandle]) {
      handle.addEventListener("keydown", (e) => this.onKeydown(e));
    }
    this.render();
  }

  private clamp(value: number): number {
    const { min, max, step, decimals } = this.o;
    const snapped = Number((Math.round(value / step) * step).toFixed(decimals));
    return Math.min(max, Math.max(min, snapped));
  }

  private valueFromPointer(event: PointerEvent): number {
    const { min, max } = this.o;
    const bounds = this.o.root.getBoundingClientRect();
    return this.clamp(
      ((event.clientX - bounds.left) / bounds.width) * (max - min) + min,
    );
  }

  private onPointerDown(event: PointerEvent): void {
    const { minHandle, maxHandle, root } = this.o;
    const target = event.target as Node;
    const grabbed = [minHandle, maxHandle].find((h) => h.contains(target));
    let handle: HTMLElement;
    if (grabbed) {
      handle = grabbed;
    } else {
      const value = this.valueFromPointer(event);
      handle =
        Math.abs(value - this.low) <= Math.abs(value - this.high)
          ? minHandle
          : maxHandle;
      this.setValue(handle, value);
    }
    this.activeHandle = handle;
    this.activePointerId = event.pointerId;
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // The range still follows pointermove when capture is unavailable.
    }
    handle.focus();
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.activeHandle || event.pointerId !== this.activePointerId) return;
    this.setValue(this.activeHandle, this.valueFromPointer(event));
  }

  private endDrag(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;
    this.activeHandle = null;
    this.activePointerId = null;
  }

  private onKeydown(event: KeyboardEvent): void {
    const handle = event.currentTarget as HTMLElement;
    const { step, pageStep, min, max } = this.o;
    const current = handle === this.o.minHandle ? this.low : this.high;
    const targets: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowDown: current - step,
      ArrowRight: current + step,
      ArrowUp: current + step,
      PageDown: current - pageStep,
      PageUp: current + pageStep,
      Home: min,
      End: max,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.setValue(handle, next);
  }

  private setValue(handle: HTMLElement, value: number): void {
    const next = this.clamp(value);
    if (handle === this.o.minHandle) {
      this.low = Math.min(next, this.high);
    } else {
      this.high = Math.max(next, this.low);
    }
    this.render();
    this.o.onChange?.();
  }

  private render(): void {
    const { min, max, fill, output, minHandle, maxHandle } = this.o;
    const span = max - min;
    fill.style.left = `${((this.low - min) / span) * 100}%`;
    fill.style.width = `${((this.high - this.low) / span) * 100}%`;
    output.textContent = this.o.formatRange(this.low, this.high);
    this.renderHandle(minHandle, this.low, this.high, "minimum");
    this.renderHandle(maxHandle, this.high, this.low, "maximum");
  }

  private renderHandle(
    handle: HTMLElement,
    value: number,
    bound: number,
    label: "minimum" | "maximum",
  ): void {
    const { min, max, decimals } = this.o;
    const isMin = label === "minimum";
    const text = value.toFixed(decimals);
    handle.style.left = `${((value - min) / (max - min)) * 100}%`;
    handle.setAttribute("aria-valuemin", String(isMin ? min : bound));
    handle.setAttribute("aria-valuemax", String(isMin ? bound : max));
    handle.setAttribute("aria-valuenow", text);
    handle.setAttribute("aria-valuetext", this.o.valueText(text, label));
  }
}
