// Deciding whether a press on the canvas was a click or a pan.
//
// Pulled out of the component because it is where selection actually broke. The
// canvas calls `setPointerCapture` so a pan keeps tracking when the cursor
// leaves the element — and capture also retargets the compatibility mouse
// events, so a `click` handler on a node never fires. Pressing a node did
// nothing at all, with no error and nothing in the console to look at.
//
// Selection is therefore resolved from the pointer events directly: the node
// records itself as the candidate on pointerdown, and the canvas decides on
// pointerup. That decision is two small rules, and they are here rather than
// inline so they can be checked without a browser.

/** How far the pointer may travel between press and release and still count as
 *  a click. Zero would make every selection depend on the user not twitching;
 *  too large and a short drag would select something instead of panning. */
export const DRAG_SLOP_PX = 4;

/** Has this press turned into a pan?
 *
 * Measured from the press origin rather than between successive moves: a slow
 * drag produces many sub-pixel deltas that would never individually cross the
 * threshold, and the gesture would stay a "click" all the way across the canvas.
 */
export function exceedsDragSlop(dx: number, dy: number, slop = DRAG_SLOP_PX): boolean {
  return Math.hypot(dx, dy) > slop;
}

/** The selection after a press ends.
 *
 * Returns the id to select, or `null` for no selection. Pressing the already
 * selected node clears it, which is what the close button in the detail panel
 * does and what a second press on the same node should mean.
 */
export function selectionAfterPress(
  candidateId: string | null,
  moved: boolean,
  current: string | null,
): string | null {
  // A pan is not a selection, however it started. Without this, dragging the
  // canvas from on top of a node would select that node on release.
  if (moved) return current;
  // Pressing empty canvas leaves the selection alone rather than clearing it —
  // clearing on every stray press would make the panel feel like it flickers.
  if (!candidateId) return current;
  return candidateId === current ? null : candidateId;
}
