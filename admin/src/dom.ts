type Child = Node | string | null | undefined | false;

interface Props {
  class?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  autocomplete?: string;
  ariaPressed?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}

/**
 * Builds an element. Text always goes in as text nodes (never innerHTML), so names and
 * notes typed by users cannot inject markup into the admin page.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.ariaPressed !== undefined) node.setAttribute('aria-pressed', String(props.ariaPressed));
  if (props.ariaLabel) node.setAttribute('aria-label', props.ariaLabel);
  if (props.onClick) node.addEventListener('click', props.onClick);
  if (node instanceof HTMLInputElement) {
    if (props.type) node.type = props.type;
    if (props.value !== undefined) node.value = props.value;
    if (props.placeholder) node.placeholder = props.placeholder;
    if (props.required) node.required = true;
    if (props.min) node.min = props.min;
    if (props.autocomplete) node.autocomplete = props.autocomplete as AutoFill;
  }
  if (node instanceof HTMLButtonElement) node.type = (props.type as 'button' | 'submit') ?? 'button';
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

export function replaceChildren(parent: HTMLElement, ...children: Child[]): void {
  parent.replaceChildren(...children.filter((child): child is Node | string => Boolean(child)));
}

/** Runs an action with the button disabled, and reports failures in `status`. */
export async function withBusy(
  button: HTMLButtonElement,
  status: HTMLElement,
  action: () => Promise<void>,
): Promise<void> {
  button.disabled = true;
  status.textContent = '';
  status.className = 'muted';
  try {
    await action();
  } catch (error) {
    status.textContent = friendly(error);
    status.className = 'error';
  } finally {
    button.disabled = false;
  }
}

export function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'NOT_ADMIN') return 'This login is not an admin.';
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/failed to fetch/i.test(message)) return 'No connection. Check your internet and try again.';
  return 'Something went wrong. Please try again.';
}
