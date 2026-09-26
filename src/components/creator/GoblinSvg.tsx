

import { forwardRef, useId, useMemo } from 'react';
import { composeGoblinSvg, type ComposeOptions } from '../../game/meta/goblin-compositor';
import type { GoblinAvatarConfig } from '../../game/meta/interfaces';

/**
 * Inline SVG portrait. Inline (not <img src=data:svg>) because painted PNG parts are referenced by URL,
 * and browsers block external resources inside SVG-as-image. Every instance gets a unique id prefix.
 */
const GoblinSvg = forwardRef<HTMLDivElement, { config: GoblinAvatarConfig; size?: number; className?: string; options?: Omit<ComposeOptions, 'idPrefix' | 'size'>; label?: string; viewBox?: string }>(
  function GoblinSvg({ config, size = 256, className, options, label, viewBox }, ref) {
    const rawId = useId();
    const prefix = `g${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const html = useMemo(() => {
      const svg = composeGoblinSvg(config, { ...options, idPrefix: prefix, size: 256 }).replace('width="256" height="256"', 'width="100%" height="100%"');
      return viewBox ? svg.replace('viewBox="0 0 256 256"', `viewBox="${viewBox}"`) : svg;
    }, [config, options, prefix, viewBox]);
    return <div ref={ref} role="img" aria-label={label ?? 'Goblin portrait'} className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
  },
);

export default GoblinSvg;
