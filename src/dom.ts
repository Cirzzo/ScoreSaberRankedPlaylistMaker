/** querySelector that throws if the element is missing, so callers get a non-null type. */
export function $<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

export function $$<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

export function setButtonLabel(button: HTMLElement, text: string): void {
  $("span", button).textContent = text;
}

/** Sets a heading to `text` followed by the styled period span. */
export function setTitle(element: HTMLElement, text: string): void {
  const period = document.createElement("span");
  period.className = "title-period";
  period.textContent = ".";
  element.replaceChildren(text, period);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
