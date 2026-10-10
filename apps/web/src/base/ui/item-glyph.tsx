import React from 'react';
import type { ItemView } from '../view';
import {
  Crosshair,
  Eye,
  Layers,
  Package,
  Shield,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';

interface ItemGlyphProps {
  item: ItemView;
  size?: number;
  className?: string;
}

export const ItemGlyph: React.FC<ItemGlyphProps> = ({ item, size = 24, className = '' }) => {
  const tint = item.tint || '#00f0ff';

  // 1. Raw Pixel: small dithered pixel cluster
  if (item.kind === 'raw-pxd') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={{ display: 'block', filter: `drop-shadow(0 0 4px ${tint}88)` }}
      >
        <rect x="5" y="7" width="4" height="4" fill={tint} opacity="0.85" rx="0.5" />
        <rect x="11" y="4" width="4" height="4" fill={tint} opacity="0.65" rx="0.5" />
        <rect x="9" y="10" width="5" height="5" fill={tint} rx="0.8" />
        <rect x="15" y="8" width="4" height="4" fill={tint} opacity="0.9" rx="0.5" />
        <rect x="5" y="14" width="4" height="4" fill={tint} opacity="0.55" rx="0.5" />
        <rect x="11" y="15" width="4" height="4" fill={tint} opacity="0.8" rx="0.5" />
        <rect x="16" y="14" width="3" height="3" fill={tint} opacity="0.4" rx="0.5" />
      </svg>
    );
  }

  // 2. Raw Vertex: wireframe triangle with vertex dots
  if (item.kind === 'raw-vtx') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={{ display: 'block', filter: `drop-shadow(0 0 4px ${tint}88)` }}
      >
        {/* Wireframe triangle */}
        <polygon
          points="12,4 4,19 20,19"
          fill="none"
          stroke={tint}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.85"
        />
        {/* Interior altitude guide */}
        <line
          x1="12"
          y1="4"
          x2="12"
          y2="19"
          stroke={tint}
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.4"
        />
        {/* Vertex dots */}
        <circle cx="12" cy="4" r="2.2" fill={tint} />
        <circle cx="4" cy="19" r="2.2" fill={tint} />
        <circle cx="20" cy="19" r="2.2" fill={tint} />
      </svg>
    );
  }

  // 3. Texture Map: swatch with tiny procedural pattern in albedo colours
  if (item.kind === 'map') {
    const patternId = `map-pat-${item.id}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={{ display: 'block', filter: `drop-shadow(0 0 3px ${tint}66)` }}
      >
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="6" y2="6" stroke="#ffffff" strokeWidth="0.8" opacity="0.25" />
            <circle cx="3" cy="3" r="0.8" fill="#ffffff" opacity="0.3" />
          </pattern>
        </defs>
        {/* Swatch tile */}
        <rect x="3" y="3" width="18" height="18" rx="3" fill={tint} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="3" y="3" width="18" height="18" rx="3" fill={`url(#${patternId})`} />
        {/* Corner specular / albedo badge */}
        <circle cx="6" cy="6" r="1.5" fill="#ffffff" opacity="0.6" />
      </svg>
    );
  }

  // 4. Primitive: shape silhouette (cube, cylinder, beam, frame)
  if (item.kind === 'primitive') {
    if (item.id === 'prim_cube') {
      // Isometric Cube
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={className}
          style={{ display: 'block', filter: `drop-shadow(0 0 3px ${tint}77)` }}
        >
          {/* Top face */}
          <polygon points="12,3 19,7 12,11 5,7" fill={tint} opacity="0.95" />
          {/* Left face */}
          <polygon points="5,7 12,11 12,19 5,15" fill={tint} opacity="0.6" />
          {/* Right face */}
          <polygon points="12,11 19,7 19,15 12,19" fill={tint} opacity="0.8" />
          {/* Outline edges */}
          <polygon
            points="12,3 19,7 19,15 12,19 5,15 5,7"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.75"
          />
        </svg>
      );
    }

    if (item.id === 'prim_col') {
      // Isometric Cylinder
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={className}
          style={{ display: 'block', filter: `drop-shadow(0 0 3px ${tint}77)` }}
        >
          {/* Body */}
          <path d="M6,7 L6,17 A6,2.5 0 0,0 18,17 L18,7 Z" fill={tint} opacity="0.7" />
          {/* Bottom curve */}
          <ellipse cx="12" cy="17" rx="6" ry="2.5" fill={tint} opacity="0.8" />
          {/* Top cap */}
          <ellipse cx="12" cy="7" rx="6" ry="2.5" fill={tint} opacity="0.95" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75" />
        </svg>
      );
    }

    if (item.id === 'prim_beam') {
      // Chamfered Beam (elongated diagonal bar)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={className}
          style={{ display: 'block', filter: `drop-shadow(0 0 3px ${tint}77)` }}
        >
          {/* Top surface */}
          <polygon points="4,10 16,4 20,7 8,13" fill={tint} opacity="0.95" />
          {/* Front face */}
          <polygon points="4,10 8,13 8,18 4,15" fill={tint} opacity="0.6" />
          {/* Side face */}
          <polygon points="8,13 20,7 20,12 8,18" fill={tint} opacity="0.75" />
          {/* Wire outline */}
          <polygon points="4,10 16,4 20,7 20,12 8,18 4,15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />
        </svg>
      );
    }

    if (item.id === 'prim_frame') {
      // Chassis Frame (wireframe truss / hollow cube)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={className}
          style={{ display: 'block', filter: `drop-shadow(0 0 3px ${tint}77)` }}
        >
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            fill="none"
            stroke={tint}
            strokeWidth="1.8"
            rx="1.5"
          />
          <rect
            x="7.5"
            y="7.5"
            width="9"
            height="9"
            fill="none"
            stroke={tint}
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.8"
          />
          <line x1="4" y1="4" x2="7.5" y2="7.5" stroke={tint} strokeWidth="1" />
          <line x1="20" y1="4" x2="16.5" y2="7.5" stroke={tint} strokeWidth="1" />
          <line x1="4" y1="20" x2="7.5" y2="16.5" stroke={tint} strokeWidth="1" />
          <line x1="20" y1="20" x2="16.5" y2="16.5" stroke={tint} strokeWidth="1" />
        </svg>
      );
    }

    // Default primitive: clean cube
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <polygon points="12,3 20,8 12,13 4,8" fill={tint} opacity="0.9" />
        <polygon points="4,8 12,13 12,21 4,16" fill={tint} opacity="0.6" />
        <polygon points="12,13 20,8 20,16 12,21" fill={tint} opacity="0.75" />
      </svg>
    );
  }

  // 5. Blueprint: cyan grid sheet
  if (item.kind === 'blueprint') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={{ display: 'block', filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.4))' }}
      >
        {/* Blueprint sheet */}
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#07131f" stroke="#00f0ff" strokeWidth="1.2" />
        {/* Cyan grid lines */}
        <line x1="7" y1="3" x2="7" y2="21" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        <line x1="12" y1="3" x2="12" y2="21" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        <line x1="17" y1="3" x2="17" y2="21" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        <line x1="3" y1="7" x2="21" y2="7" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        <line x1="3" y1="17" x2="21" y2="17" stroke="#00f0ff" strokeWidth="0.5" opacity="0.4" />
        {/* Schematic diagram in center */}
        <rect x="7" y="7" width="10" height="10" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" />
        <circle cx="12" cy="12" r="2" fill="#00f0ff" opacity="0.7" />
      </svg>
    );
  }

  // 6. Bulk (e.g. ore)
  if (item.kind === 'bulk') {
    return <Layers size={size} color={tint} className={className} />;
  }

  // 7. Tool
  if (item.kind === 'tool') {
    return <Wrench size={size} color={tint} className={className} />;
  }

  // 8. Weapon
  if (item.kind === 'weapon') {
    return <Crosshair size={size} color={tint} className={className} />;
  }

  // 9. Equipment
  if (item.kind === 'equip') {
    if (item.id === 'equip_visor') {
      return <Eye size={size} color={tint} className={className} />;
    }
    if (item.id === 'equip_shield') {
      return <Shield size={size} color={tint} className={className} />;
    }
    if (item.id === 'equip_rebreather') {
      return <Wind size={size} color={tint} className={className} />;
    }
    return <Zap size={size} color={tint} className={className} />;
  }

  return <Package size={size} color={tint} className={className} />;
};
