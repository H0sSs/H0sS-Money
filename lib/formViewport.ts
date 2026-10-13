// Work from current native measurements, including modal clipping and fixed actions.
export function fieldScrollDelta(viewTop: number, viewHeight: number, inputTop: number, inputHeight: number, keyboardTop: number, gap = 24): number {
  const top = viewTop + gap;
  const bottom = Math.min(viewTop + viewHeight, keyboardTop) - gap;
  if (bottom <= top || inputHeight <= 0) return 0;
  if (inputTop + inputHeight > bottom) return inputTop + inputHeight - bottom;
  if (inputTop < top) return inputTop - top;
  return 0;
}
