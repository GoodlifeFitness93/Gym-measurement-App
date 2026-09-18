/**
 * Centralised hardware/browser Back handling.
 *
 * The app has no router, so the Android system Back button used to fall
 * straight through to the browser and exit the PWA even when the user was
 * several screens deep or had a sheet open.
 *
 * Approach: keep our own logical stack of back handlers and hold exactly ONE
 * extra history entry ("the trap") while that stack is non-empty. A Back press
 * consumes the trap, we run the top handler, then re-arm the trap if there is
 * still internal history left. When nothing is left we deliberately do NOT
 * re-arm, so the next Back exits normally and the user is never trapped.
 *
 * Handlers return `true` to stay registered (screen stacks that still have
 * depth) or `false`/void to be popped (modals, which close once).
 */

type BackHandler = () => boolean | void;

interface Entry {
  id: number;
  handler: BackHandler;
}

const entries: Entry[] = [];
let nextId = 1;
let trapArmed = false;
let listening = false;

const TRAP_STATE = { __goodlifeBackTrap: true };

function arm() {
  if (trapArmed) return;
  try {
    window.history.pushState(TRAP_STATE, '');
    trapArmed = true;
  } catch {
    /* history unavailable (very old webview) — Back simply behaves natively */
  }
}

function disarm() {
  if (!trapArmed) return;
  trapArmed = false;
  try {
    window.history.back();
  } catch {
    /* ignore */
  }
}

function onPopState() {
  // The trap entry we pushed has just been consumed.
  trapArmed = false;

  const top = entries[entries.length - 1];
  if (!top) return; // nothing of ours left: let the browser/OS proceed

  let keep: boolean | void = false;
  try {
    keep = top.handler();
  } catch {
    keep = false;
  }

  if (!keep) {
    const idx = entries.indexOf(top);
    if (idx !== -1) entries.splice(idx, 1);
  }

  if (entries.length > 0) arm();
}

export function pushBackHandler(handler: BackHandler): number {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const id = nextId++;
  entries.push({ id, handler });
  arm();
  return id;
}

export function removeBackHandler(id: number): void {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  entries.splice(idx, 1);
  if (entries.length === 0) disarm();
}

export function backStackDepth(): number {
  return entries.length;
}
