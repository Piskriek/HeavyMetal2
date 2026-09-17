import { useMemo, useState } from 'react';
import { ArrowDownToLine, Image as ImageIcon, Layers, Ruler } from 'lucide-react';
import {
  ART, ART_CELLS, ART_GENERATED_AT, LANDMARK_IDS, artUrl, capsuleCell, courseCell, landmarkCell, riderCell, supplyCell, blimpCell,
} from '../game/art-assets';
import { CAPSULES, RIDERS } from '../game/loadouts';
import { COURSES } from '../game/types';
import { POWERUPS, type PowerupKind } from '../game/powerups';
import { TRACKS } from '../game/courses';

function download(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

interface Entry {
  key: string;
  label: string;
  detail: string;
  src: string;
  file: string;
  meta: string;
}

/**
 * The sprite lab lists exactly the PNGs the game draws, with the manifest data that places
 * them (hatch circles, hull diameter, baselines). Downloads are the runtime files themselves,
 * so what a visitor saves is what the race uses. Source sheets stay available separately.
 */
export default function ArtGallery() {
  const [view, setView] = useState<'runtime' | 'sheets'>('runtime');

  const groups = useMemo(() => {
    const riderEntries: Entry[] = RIDERS.map((rider) => {
      const cell = riderCell(rider.id);
      return {
        key: `rider-${rider.id}`, label: `${rider.name} portrait`, detail: `${rider.title} / alpha PNG`,
        src: artUrl(cell.image), file: `${rider.id}-portrait.png`,
        meta: `${cell.runtime.width}x${cell.runtime.height} / sheet cell ${cell.sheetCell + 1}`,
      };
    });
    const pilotEntries: Entry[] = RIDERS.map((rider) => {
      const cell = riderCell(rider.id);
      return {
        key: `pilot-${rider.id}`, label: `${rider.name} cockpit pilot`, detail: 'Seated in the measured hatch',
        src: artUrl(cell.pilot ?? cell.image), file: `${rider.id}-pilot.png`,
        meta: `${cell.pilotRuntime?.width ?? 0}x${cell.pilotRuntime?.height ?? 0} / eye line ${(cell.eyeLine ?? 0.44).toFixed(2)}`,
      };
    });
    const shellEntries: Entry[] = CAPSULES.map((capsule) => {
      const cell = capsuleCell(capsule.id);
      return {
        key: `shell-${capsule.id}`, label: `${capsule.name} shell`, detail: `${capsule.title} / open hatch`,
        src: artUrl(cell.image), file: `${capsule.id}-shell.png`,
        meta: `hull ${cell.hull?.diameter ?? 452}px of ${cell.hull?.canvas ?? 512} / hatch ${(cell.hatch?.x ?? 0).toFixed(2)},${(cell.hatch?.y ?? 0).toFixed(2)} r${(cell.hatch?.radius ?? 0).toFixed(2)}`,
      };
    });
    const supplyEntries: Entry[] = (Object.keys(POWERUPS) as PowerupKind[]).map((kind) => {
      const cell = supplyCell(kind);
      return {
        key: `supply-${kind}`, label: POWERUPS[kind].name, detail: POWERUPS[kind].label,
        src: artUrl(cell.image), file: `${kind}-supply.png`,
        meta: `${cell.runtime.width}x${cell.runtime.height} / ${cell.sheet}`,
      };
    });
    const propEntries: Entry[] = [
      { key: 'blimp', label: 'Goblin blimp', detail: `${TRACKS.ridge.region} airship, background scenery`, src: artUrl(blimpCell().image), file: 'blimp.png', meta: `${blimpCell().runtime.width}x${blimpCell().runtime.height} / drifts past, never a hazard` },
      ...LANDMARK_IDS.map((id) => {
        const cell = landmarkCell(id);
        return { key: `landmark-${id}`, label: `Landmark: ${id}`, detail: 'Roadside prop, baseline aligned', src: artUrl(cell.image), file: `landmark-${id}.png`, meta: `${cell.runtime.width}x${cell.runtime.height} / anchored at the ground line` };
      }),
    ];
    const courseEntries: Entry[] = COURSES.map((course) => ({
      key: `course-${course.id}`, label: `${course.name} preview`, detail: TRACKS[course.id].region, src: artUrl(courseCell(course.id).image),
      file: `${course.id}-course.png`, meta: '800x440 / selection thumbnail',
    }));
    return [
      { name: 'Riders', entries: riderEntries },
      { name: 'Cockpit pilots', entries: pilotEntries },
      { name: 'Capsule shells', entries: shellEntries },
      { name: 'Air supplies', entries: supplyEntries },
      { name: 'World props', entries: propEntries },
      { name: 'Course art', entries: courseEntries },
    ];
  }, []);

  const sheets = Object.entries(ART.sheets);
  const cellCount = Object.keys(ART_CELLS).length;

  return (
    <div className="art-gallery">
      <div className="sprite-toolbar">
        <div>
          <h3>Painted sprites, honestly catalogued.</h3>
          <p>Every image the race and menus draw, with the manifest data that places it. {cellCount} sprites from {sheets.length} source sheets, generated {ART_GENERATED_AT}.</p>
        </div>
        <div className="sprite-view-toggle" role="tablist" aria-label="Art views">
          <button role="tab" aria-selected={view === 'runtime'} className={view === 'runtime' ? 'selected' : ''} onClick={() => setView('runtime')}><Layers size={13} /> RUNTIME PNGs</button>
          <button role="tab" aria-selected={view === 'sheets'} className={view === 'sheets' ? 'selected' : ''} onClick={() => setView('sheets')}><ImageIcon size={13} /> SOURCE SHEETS</button>
        </div>
      </div>

      {view === 'runtime' ? groups.map((group) => (
        <section className="art-group" key={group.name}>
          <h4>{group.name}<span>{group.entries.length}</span></h4>
          <div className="art-grid">
            {group.entries.map((entry) => (
              <button className="art-tile" key={entry.key} onClick={() => download(entry.src, entry.file)} title={`Download ${entry.file}`}>
                <ArrowDownToLine size={14} />
                <img src={entry.src} alt={entry.label} loading="lazy" decoding="async" />
                <span>{entry.label}</span>
                <small>{entry.detail}</small>
                <em>{entry.meta}</em>
              </button>
            ))}
          </div>
        </section>
      )) : (
        <div className="art-sheets">
          <p className="art-note">
            Source sheets are the generated originals the runtime crops are cut from. Each was painted on a flat
            key colour and converted to true alpha at build time by <code>scripts/build-art.mjs</code>; the key
            colour is recorded per sheet. Magenta <strong>#FF00FF</strong> is used wherever the subject
            itself is green. No Blizzard assets, logos or characters are used anywhere in this library.
          </p>
          <div className="art-grid sheets">
            {sheets.map(([name, sheet]) => {
              const matte = ART.matte[name];
              return (
                <button className="art-tile sheet" key={name} onClick={() => download(artUrl(sheet.file), `${name}-sheet.png`)} title={`Download ${name}-sheet.png`}>
                  <ArrowDownToLine size={14} />
                  <img src={artUrl(sheet.file)} alt={`${name} source sheet`} loading="lazy" decoding="async" />
                  <span>{name}</span>
                  <small>{sheet.columns}x{sheet.rows} grid / {sheet.width}x{sheet.height}</small>
                  <em>{matte ? `${matte.detected} key ${matte.hex} / target ${matte.canonical}` : 'painted alpha / no key'}</em>
                </button>
              );
            })}
          </div>
          <p className="sprite-key-note"><Ruler size={14} />
            <span>PLACED BY MANIFEST</span>
            <p>Hatch circles, hull diameter, eye lines and ground baselines are measured from the artwork and stored in <code>src/game/art-manifest.json</code>, so nothing in the game guesses where a pilot sits.</p>
          </p>
        </div>
      )}
    </div>
  );
}
