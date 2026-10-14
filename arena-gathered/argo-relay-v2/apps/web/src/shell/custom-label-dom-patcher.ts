// ============================================================================
// File: apps/web/src/shell/custom-label-dom-patcher.ts
// Fix: Extracted DOM helper from @hm/questline so packages/questline stays 100% pure
// ============================================================================

import type { CustomResourceLabels } from '../../../../../packages/questline/src/act789-chain';

export function applyCustomLabelsToDom(
  root: ParentNode,
  labels: CustomResourceLabels
): number {
  const nodes = root.querySelectorAll('[data-resource-label]');
  let count = 0;
  nodes.forEach((el) => {
    const kind = el.getAttribute('data-resource-label');
    if (kind === 'dirt') {
      el.textContent = labels.dirtLabel;
      count++;
    } else if (kind === 'ore') {
      el.textContent = labels.oreLabel;
      count++;
    }
  });
  return count;
}
