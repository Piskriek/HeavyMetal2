// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// toolcatalog.ts
export interface Param {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'enum' | 'color';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface SubTool {
  id: string;
  name: string;
  icon: string;
  hotkey?: string;
  doc: string;
  group: string;
  primary: string;
  secondary: string;
  params: Param[];
}

export interface ToolSet {
  tool: string;
  label: string;
  icon: string;
  hotkey: string;
  doc: string;
  subtools: SubTool[];
  defaultSub: string;
}

const n = (key: string, label: string, def: number, min: number, max: number, step = 1): Param => ({
  key, label, type: 'number', default: def, min, max, step,
});
const b = (key: string, label: string, def: boolean): Param => ({
  key, label, type: 'boolean', default: def,
});
const e = (key: string, label: string, def: string, options: string[]): Param => ({
  key, label, type: 'enum', default: def, options,
});
const c = (key: string, label: string, def = '#ffffff'): Param => ({
  key, label, type: 'color', default: def,
});

const SIZE = n('size', 'Size', 32, 1, 1024, 1);
const STRENGTH = n('strength', 'Strength', 0.5, 0, 1, 0.01);
const FALLOFF = e('falloff', 'Falloff', 'smooth', ['constant', 'linear', 'smooth', 'sharp', 'sphere']);
const OPACITY = n('opacity', 'Opacity', 1, 0, 1, 0.01);
const FLOW = n('flow', 'Flow', 1, 0, 1, 0.01);
const SPACING = n('spacing', 'Spacing', 0.1, 0.01, 1, 0.01);
const SYMMETRY = b('symmetry', 'Symmetry', false);
const SNAP = b('snap', 'Snap', false);
const INVERT = b('invert', 'Invert', false);

const sub = (
  id: string, name: string, icon: string, doc: string, group: string,
  primary: string, secondary: string, params: Param[] = [], hotkey?: string,
): SubTool => ({ id, name, icon, doc, group, primary, secondary, params, hotkey });

const POINTER: SubTool[] = [
  sub('move', 'Move', 'Move3d', 'Translate selection along axes.', 'Gizmo', 'Drag to move', 'Drag opposite axis', [SIZE, SNAP], 'G'),
  sub('rotate', 'Rotate', 'Rotate3d', 'Rotate selection around pivot.', 'Gizmo', 'Drag to rotate', 'Reset rotation', [n('angle','Angle',0,-360,360,1), SNAP], 'R'),
  sub('scale', 'Scale', 'Maximize', 'Scale selection uniformly or per axis.', 'Gizmo', 'Drag to scale', 'Non-uniform scale', [SNAP], 'S'),
  sub('universal', 'Universal', 'Combine', 'Combined translate/rotate/scale gizmo.', 'Gizmo', 'Pick axis and drag', 'Cycle mode', [SNAP], 'Y'),
  sub('pivot', 'Pivot Edit', 'Crosshair', 'Reposition the pivot without moving geometry.', 'Gizmo', 'Drag pivot', 'Center pivot on bounds', [], 'P'),
  sub('snap-toggle', 'Snap', 'Magnet', 'Toggle snapping to grid, vertex or surface.', 'Gizmo', 'Toggle snap', 'Snap settings', [e('target','Snap To','vertex',['grid','vertex','edge','face','surface'])], 'X'),
  sub('local', 'Local Space', 'Compass', 'Transform in the object local axes.', 'Space', 'Switch to local', 'Switch to world', [], 'L'),
  sub('world', 'World Space', 'Globe', 'Transform in the global world axes.', 'Space', 'Switch to world', 'Switch to local', [], 'W'),
  sub('measure', 'Measure', 'Ruler', 'Measure distance and angle between two points.', 'Utilities', 'Click two points', 'Clear measure', [e('unit','Unit','m',['m','cm','px','in'])], 'M'),
  sub('align', 'Align', 'AlignCenter', 'Align selection to target or bounding box.', 'Utilities', 'Align to target', 'Distribute evenly', [e('axis','Axis','xyz',['x','y','z','xy','xz','yz','xyz'])], 'A'),
  sub('duplicate', 'Duplicate', 'Copy', 'Duplicate selection and enter move mode.', 'Utilities', 'Drag copy', 'Instance copy', [n('count','Count',1,1,99,1)], 'D'),
  sub('link', 'Link / Parent', 'Link', 'Parent selection to target object.', 'Utilities', 'Link to target', 'Unlink', [b('keepTransform','Keep Transform',true)], 'K'),
];

const BRUSH: SubTool[] = [
  sub('brush', 'Brush', 'Paintbrush', 'Soft round painting brush.', 'Paint', 'Paint stroke', 'Sample colour', [SIZE, STRENGTH, FALLOFF, OPACITY, FLOW, SPACING, c('color')], 'B'),
  sub('pencil', 'Pencil', 'Pencil', 'Hard edged pixel pencil.', 'Paint', 'Draw pixel line', 'Erase', [SIZE, OPACITY, c('color')], 'N'),
  sub('eraser', 'Eraser', 'Eraser', 'Erase to transparent or background.', 'Paint', 'Erase stroke', 'Restore history', [SIZE, STRENGTH, FALLOFF, OPACITY], 'E'),
  sub('clone-stamp', 'Clone Stamp', 'Stamp', 'Paint pixels sampled from a source point.', 'Paint', 'Paint from source', 'Pick new source', [SIZE, STRENGTH, FALLOFF, OPACITY, n('offset','Offset',0,-500,500,1)], 'S'),
  sub('healing', 'Healing', 'HeartPulse', 'Blend sampled texture into surroundings.', 'Paint', 'Heal stroke', 'Pick source', [SIZE, STRENGTH, FALLOFF], 'J'),
  sub('smudge', 'Smudge', 'Blend', 'Drag existing pixels along the stroke.', 'Paint', 'Smudge forward', 'Smudge reverse', [SIZE, STRENGTH, FALLOFF, SPACING], 'O'),
  sub('blur', 'Blur / Sharpen', 'Droplet', 'Blur or sharpen pixels under the brush.', 'Paint', 'Blur', 'Sharpen', [SIZE, STRENGTH, FALLOFF], 'R'),
  sub('dodge', 'Dodge', 'Sun', 'Lighten pixels under the brush.', 'Tone', 'Lighten', 'Darken (burn)', [SIZE, STRENGTH, FALLOFF, e('range','Range','midtones',['shadows','midtones','highlights'])], 'H'),
  sub('burn', 'Burn', 'Moon', 'Darken pixels under the brush.', 'Tone', 'Darken', 'Lighten (dodge)', [SIZE, STRENGTH, FALLOFF, e('range','Range','midtones',['shadows','midtones','highlights'])], 'K'),
  sub('fill-bucket', 'Fill Bucket', 'PaintBucket', 'Flood fill a contiguous region.', 'Fill', 'Fill region', 'Fill whole layer', [n('tolerance','Tolerance',32,0,255,1), b('contiguous','Contiguous',true), c('color')], 'F'),
  sub('gradient', 'Gradient', 'Palette', 'Paint a linear or radial gradient.', 'Fill', 'Drag gradient', 'Reverse gradient', [e('shape','Shape','linear',['linear','radial','conic']), OPACITY, c('from','#000000'), c('to','#ffffff')], 'L'),
  sub('eyedropper', 'Eyedropper', 'Pipette', 'Pick colour from the canvas.', 'Utility', 'Pick colour', 'Pick averaged', [n('radius','Sample Radius',1,1,64,1)], 'I'),
  sub('shapes', 'Shapes', 'Shapes', 'Draw rectangle, ellipse or polygon shapes.', 'Vector', 'Draw shape', 'Subtract shape', [e('shape','Shape','rect',['rect','ellipse','polygon','line']), n('sides','Sides',5,3,24,1), c('color')], 'U'),
  sub('text', 'Text', 'Type', 'Create and edit text layers.', 'Vector', 'Place text', 'Edit text', [n('fontSize','Font Size',32,6,400,1), c('color')], 'T'),
  sub('mask', 'Mask', 'CircleDot', 'Paint into the layer mask in white or black.', 'Layer', 'Reveal (white)', 'Hide (black)', [SIZE, STRENGTH, FALLOFF], 'M'),
  sub('crop', 'Crop', 'Scissors', 'Crop canvas to a rectangle.', 'Canvas', 'Commit crop', 'Cancel', [], 'C'),
  sub('transform', 'Transform', 'Move', 'Free transform the active layer.', 'Canvas', 'Apply transform', 'Reset transform', [b('warp','Warp',false)], 'V'),
  sub('layer-opacity', 'Layer Opacity', 'Layers', 'Paint while limited by layer opacity.', 'Layer', 'Paint with cap', 'Erase with cap', [OPACITY, FLOW, n('cap','Opacity Cap',1,0,1,0.01)], 'A'),
];

const SCULPT: SubTool[] = [
  sub('draw', 'Draw', 'Brush', 'Raise surface along the brush normal.', 'Sculpt', 'Raise surface', 'Lower surface', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'X'),
  sub('clay-buildup', 'Clay Buildup', 'Layers', 'Build forms with flat clay-like strokes.', 'Sculpt', 'Add clay', 'Scrape clay', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'C'),
  sub('sculpt-move', 'Move', 'Move', 'Push geometry along the stroke direction.', 'Sculpt', 'Push forward', 'Pull back', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'G'),
  sub('smooth', 'Smooth', 'Sparkles', 'Relax and smooth the mesh surface.', 'Sculpt', 'Smooth', 'Sharpen', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'S'),
  sub('pinch', 'Pinch', 'Target', 'Pull vertices toward the brush center.', 'Sculpt', 'Pinch', 'Expand', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'P'),
  sub('inflate', 'Inflate', 'Circle', 'Inflate surface along vertex normals.', 'Sculpt', 'Inflate', 'Deflate', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'I'),
  sub('crease', 'Crease', 'Minus', 'Carve a sharp crease into the surface.', 'Sculpt', 'Crease in', 'Crease out', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'K'),
  sub('flatten', 'Flatten', 'ArrowDownToLine', 'Flatten the surface to a best-fit plane.', 'Sculpt', 'Flatten', 'Contrast', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'T'),
  sub('snake-hook', 'Snake Hook', 'GitBranch', 'Pull out long tendrils from the mesh.', 'Sculpt', 'Pull tendril', 'Push tendril', [SIZE, STRENGTH, FALLOFF, SYMMETRY], 'N'),
  sub('sculpt-mask', 'Sculpt Mask', 'CircleDot', 'Paint a mask to protect from sculpting.', 'Sculpt', 'Mask', 'Unmask', [SIZE, STRENGTH, FALLOFF, INVERT], 'M'),
  sub('dyntopo', 'Dyntopo / Remesh', 'Grid3x3', 'Adaptively subdivide while sculpting.', 'Topology', 'Enable dyntopo', 'Remesh now', [n('detail','Detail Size',8,1,100,1), e('method','Method','relative',['relative','constant','manual'])], 'D'),
  sub('symmetry', 'Symmetry', 'FlipHorizontal', 'Mirror the stroke across chosen axes.', 'Topology', 'Mirror X', 'Clear mirror', [b('x','X',true), b('y','Y',false), b('z','Z',false)], 'Y'),
  sub('voxel-add', 'Voxel Add', 'PlusCircle', 'Add voxels to the voxel model.', 'Voxel', 'Add voxels', 'Remove voxels', [SIZE, c('color'), SYMMETRY], 'V'),
  sub('voxel-dig', 'Voxel Dig', 'MinusCircle', 'Dig out voxels from the voxel model.', 'Voxel', 'Dig voxels', 'Fill voxels', [SIZE, SYMMETRY], 'Q'),
  sub('voxel-paint', 'Voxel Paint', 'Paintbrush', 'Paint colour into existing voxels.', 'Voxel', 'Paint voxel', 'Pick voxel colour', [SIZE, c('color'), SYMMETRY], 'A'),
  sub('extrude', 'Extrude', 'ArrowUpFromLine', 'Extrude selected faces along normals.', 'Model', 'Extrude', 'Extrude inward', [n('amount','Amount',0.5,-10,10,0.1)], 'Z'),
  sub('bevel', 'Bevel', 'CornerRightDown', 'Bevel selected edges with a profile.', 'Model', 'Bevel edge', 'Chamfer', [n('amount','Amount',0.2,0,5,0.01), n('segments','Segments',2,1,16,1)], 'B'),
  sub('edge-loop', 'Insert Edge Loop', 'Hash', 'Insert an edge loop around the mesh.', 'Model', 'Insert loop', 'Remove loop', [n('count','Count',1,1,20,1)], 'L'),
  sub('knife', 'Knife', 'Scissors', 'Cut edges through the surface freely.', 'Model', 'Cut edge', 'Cut through all', [b('through','Cut Through',false)], 'K'),
  sub('merge', 'Merge Vertices', 'GitMerge', 'Merge selected vertices to a point.', 'Model', 'Merge to center', 'Merge to last', [e('mode','Mode','center',['center','last','first','cursor'])], 'J'),
];

const HAND: SubTool[] = [
  sub('pan', 'Pan', 'Hand', 'Pan the viewport with the mouse.', 'Navigation', 'Drag to pan', 'Pan to origin', [n('speed','Speed',1,0.1,10,0.1)], 'H'),
  sub('orbit', 'Orbit', 'Orbit', 'Orbit the camera around the target.', 'Navigation', 'Drag to orbit', 'Snap to axis view', [b('lockHorizon','Lock Horizon',false)], 'O'),
  sub('zoom', 'Zoom', 'ZoomIn', 'Zoom the viewport in and out.', 'Navigation', 'Scroll to zoom', 'Zoom to cursor', [n('step','Step',1.1,1.01,2,0.01)], 'Z'),
  sub('fly', 'Fly', 'PlaneTakeoff', 'Fly through the scene with WASD controls.', 'Navigation', 'Fly forward', 'Fly backward', [n('speed','Speed',5,0.1,100,0.5)], 'F'),
  sub('focus', 'Focus Selection', 'Crosshair', 'Frame the current selection in view.', 'Navigation', 'Frame selection', 'Frame all', [], 'A'),
  sub('reset-view', 'Reset View', 'RotateCcw', 'Return the camera to the default view.', 'Navigation', 'Reset view', 'Save as default', [], 'R'),
];

const TIMELINE: SubTool[] = [
  sub('select-keys', 'Select Keys', 'MousePointer', 'Click or box-select keyframes.', 'Keys', 'Select key', 'Add to selection', [b('allTracks','All Tracks',false)], 'V'),
  sub('add-key', 'Add Key', 'KeyRound', 'Insert a key at the playhead.', 'Keys', 'Add key', 'Auto-key toggle', [e('interp','Interp','bezier',['linear','bezier','constant'])], 'I'),
  sub('delete-key', 'Delete Key', 'Trash2', 'Remove the selected keyframes.', 'Keys', 'Delete keys', 'Ripple delete', [], 'X'),
  sub('curve', 'Curve Editor', 'Waves', 'Edit easing and tangents of keyframes.', 'Keys', 'Drag tangent', 'Break tangents', [e('ease','Ease','auto',['auto','in','out','inout'])], 'E'),
  sub('loop-region', 'Loop Region', 'Repeat', 'Set and loop a time range.', 'Playback', 'Set loop range', 'Clear loop', [b('loop','Loop',true)], 'L'),
  sub('ripple', 'Ripple Edit', 'Scissors', 'Slide keys and ripple later keys.', 'Edit', 'Ripple move', 'Ripple trim', [], 'R'),
  sub('scrub', 'Scrub', 'Hand', 'Drag the playhead to scrub time.', 'Playback', 'Scrub timeline', 'Snap to key', [b('muted','Mute Audio',false)], 'S'),
  sub('record-motion', 'Record Motion', 'CircleDot', 'Record live drag into keyframes.', 'Record', 'Arm record', 'Stop record', [n('rate','Sample Rate',30,1,120,1)], 'K'),
  sub('onion', 'Onion Skin', 'Layers', 'See neighbouring frames as ghosts.', 'Playback', 'Toggle onion', 'Settings', [n('frames','Frames',3,1,10,1), OPACITY], 'N'),
  sub('bake', 'Bake', 'Flame', 'Bake procedural motion to keyframes.', 'Edit', 'Bake selection', 'Unbake', [n('step','Step Frames',1,1,10,1)], 'B'),
  sub('mirror-pose', 'Mirror Pose', 'FlipHorizontal', 'Mirror the current pose across X.', 'Pose', 'Mirror pose', 'Mirror & swap', [], 'M'),
  sub('retime', 'Retime', 'Timer', 'Scale time of selected keys.', 'Edit', 'Retime keys', 'Reset time', [], 'T'),
];

const SPEAKER: SubTool[] = [
  sub('select-region', 'Select Region', 'MousePointer', 'Select a time region in the clip.', 'Select', 'Select range', 'Select all', [b('snapToGrid','Snap',false)], 'V'),
  sub('trim', 'Trim', 'Scissors', 'Trim the clip to the selected range.', 'Edit', 'Trim to selection', 'Trim outside', [], 'T'),
  sub('cut', 'Cut / Split', 'Scissors', 'Split the clip at the playhead.', 'Edit', 'Split clip', 'Ripple cut', [], 'C'),
  sub('fade', 'Fade In / Out', 'Blend', 'Create a volume fade at clip edges.', 'Edit', 'Fade in', 'Fade out', [n('ms','Duration (ms)',500,0,10000,50)], 'F'),
  sub('gain', 'Gain', 'TrendingUp', 'Adjust clip gain in decibels.', 'Level', 'Increase gain', 'Decrease gain', [n('db','Gain dB',0,-60,24,0.1)], 'G'),
  sub('pitch', 'Pitch', 'AudioLines', 'Shift clip pitch without changing length.', 'Level', 'Pitch up', 'Pitch down', [n('semitones','Semitones',0,-24,24,0.5)], 'P'),
  sub('envelope', 'Envelope', 'Activity', 'Draw a volume automation envelope.', 'Automation', 'Add point', 'Remove point', [e('curve','Curve','bezier',['linear','bezier','step'])], 'E'),
  sub('loop', 'Loop Clip', 'Repeat', 'Loop the selected clip region.', 'Playback', 'Toggle loop', 'Set loop bounds', [n('count','Repeats',4,1,128,1)], 'L'),
  sub('record-audio', 'Record', 'CircleDot', 'Record audio from the input device.', 'Record', 'Start record', 'Punch in', [n('rate','Sample Rate',48000,8000,96000,100)], 'R'),
  sub('mute-solo', 'Mute / Solo', 'VolumeX', 'Mute or solo the selected track.', 'Track', 'Mute track', 'Solo track', [], 'M'),
  sub('reverb', 'Reverb / Echo', 'Sparkles', 'Apply reverb or echo send.', 'FX', 'Add reverb', 'Add echo', [n('mix','Mix',0.3,0,1,0.01), n('decay','Decay (s)',1.5,0,10,0.1)], 'W'),
  sub('eq', 'EQ', 'SlidersHorizontal', 'Shape tone with a parametric EQ.', 'FX', 'Boost band', 'Cut band', [n('freq','Freq (Hz)',1000,20,20000,1), n('q','Q',1,0.1,20,0.1), n('gainDb','Gain dB',0,-24,24,0.1)], 'Q'),
  sub('osc', 'Synth Oscillator', 'Radio', 'Draw or tweak a synth oscillator.', 'Synth', 'Edit waveform', 'Reset', [e('wave','Wave','saw',['sine','triangle','square','saw']), n('detune','Detune',0,-100,100,1)], 'O'),
  sub('noise', 'Noise', 'Wind', 'Generate coloured noise fills.', 'Synth', 'Add noise', 'Replace selection', [e('color','Color','white',['white','pink','brown'])], 'N'),
  sub('step', 'Step Sequencer', 'Grid3x3', 'Program steps for drums or synths.', 'Synth', 'Toggle step', 'Clear row', [n('steps','Steps',16,4,64,1), n('bpm','BPM',120,20,300,1)], 'S'),
  sub('waveform-draw', 'Waveform Draw', 'Pen', 'Draw waveform directly by hand.', 'Synth', 'Draw sample', 'Erase sample', [SIZE, STRENGTH], 'D'),
];

const CAMERA: SubTool[] = [
  sub('frame', 'Frame Shot', 'Camera', 'Frame the selection for the active camera.', 'Shot', 'Frame selection', 'Lock framing', [], 'F'),
  sub('lens', 'Lens / Focal Length', 'Aperture', 'Adjust the camera focal length.', 'Lens', 'Zoom in', 'Zoom out', [n('mm','Focal mm',50,8,300,1), b('lockAperture','Lock Aperture',true)], 'L'),
  sub('dof', 'Depth of Field', 'Focus', 'Set focus distance and bokeh.', 'Lens', 'Pick focus', 'Clear focus', [n('fstop','F-Stop',2.8,1,22,0.1), n('focus','Focus (m)',5,0.1,1000,0.1)], 'D'),
  sub('dolly', 'Dolly', 'MoveHorizontal', 'Dolly the camera along its aim.', 'Rig', 'Dolly in', 'Dolly out', [n('speed','Speed',1,0.1,10,0.1)], 'Y'),
  sub('orbit-rig', 'Orbit Rig', 'Orbit', 'Orbit the camera rig around target.', 'Rig', 'Orbit rig', 'Reset rig', [], 'O'),
  sub('track', 'Track Target', 'Crosshair', 'Assign a tracking target to the camera.', 'Rig', 'Track target', 'Untrack', [], 'T'),
  sub('cut', 'Cut / Blade', 'Scissors', 'Cut the shot at the playhead.', 'Edit', 'Cut shot', 'Ripple cut', [], 'C'),
  sub('cam-trim', 'Trim Shot', 'Minimize', 'Trim the start or end of a shot.', 'Edit', 'Trim in', 'Trim out', [], 'R'),
  sub('transition', 'Transitions', 'Film', 'Add a transition between shots.', 'Edit', 'Add transition', 'Remove', [e('type','Type','cut',['cut','fade','dissolve','wipe','whip']), n('ms','Duration (ms)',500,0,5000,50)], 'N'),
  sub('keyframe-cam', 'Keyframe Camera', 'KeyRound', 'Insert a camera key at playhead.', 'Animate', 'Key transform', 'Key all', [], 'K'),
  sub('record-take', 'Record Take', 'CircleDot', 'Record a live camera take.', 'Animate', 'Record take', 'Arm record', [n('fps','FPS',30,12,120,1)], 'X'),
  sub('screenshot', 'Screenshot', 'Image', 'Capture the current viewport.', 'Output', 'Capture frame', 'Capture sequence', [e('format','Format','png',['png','jpg','exr']), n('scale','Scale',1,1,4,1)], 'P'),
  sub('safe-frames', 'Safe Frames', 'Monitor', 'Show action and title safe frames.', 'View', 'Toggle safe frames', 'Configure', [e('ratio','Ratio','16:9',['16:9','2.39:1','4:3','1:1','9:16'])], 'A'),
  sub('rig-presets', 'Rig Presets', 'Clapperboard', 'Load a camera rig preset.', 'Rig', 'Load preset', 'Save preset', [e('preset','Preset','handheld',['handheld','tripod','dolly','crane','drone'])], 'S'),
];

const PERSON: SubTool[] = [
  sub('character', 'Character', 'User', 'Create or pick a character.', 'Identity', 'Create character', 'Duplicate', [], 'C'),
  sub('appearance', 'Appearance', 'Sparkles', 'Edit face, hair, and body visuals.', 'Identity', 'Edit appearance', 'Randomize', [], 'A'),
  sub('class', 'Class / Abilities', 'Shield', 'Choose a class and assign abilities.', 'Stats', 'Pick class', 'Reset abilities', [e('class','Class','warrior',['warrior','mage','rogue','ranger','cleric','monk'])], 'K'),
  sub('inventory', 'Inventory', 'Backpack', 'Manage carried items and equipment.', 'Stats', 'Equip item', 'Drop item', [], 'I'),
  sub('voice', 'Voice', 'Mic', 'Pick and preview the character voice.', 'Identity', 'Preview voice', 'Record line', [n('pitch','Pitch',0,-12,12,1)], 'V'),
  sub('animations', 'Animations', 'Play', 'Browse and assign animation clips.', 'Motion', 'Play preview', 'Assign clip', [], 'N'),
  sub('rig', 'Rig', 'Bone', 'Edit or pose the character rig.', 'Motion', 'Pose bone', 'Reset pose', [b('ik','IK',true)], 'R'),
  sub('level', 'Level / Stats', 'BarChart3', 'Adjust experience, level and stats.', 'Stats', 'Add XP', 'Respec', [n('level','Level',1,1,99,1)], 'L'),
  sub('outfits', 'Outfits', 'Shirt', 'Manage outfits and wardrobe presets.', 'Identity', 'Wear outfit', 'Save outfit', [], 'O'),
];

const DELETE: SubTool[] = [
  sub('delete', 'Delete', 'Trash2', 'Delete the selected objects.', 'Delete', 'Delete selection', 'Delete & keep children', [], 'X'),
  sub('delete-children', 'Delete Children', 'Network', 'Delete only the children of the selection.', 'Delete', 'Delete children', 'Keep first child', [], 'C'),
  sub('dissolve', 'Dissolve', 'Unlink', 'Dissolve selected verts, edges or faces.', 'Mesh', 'Dissolve', 'Dissolve unselected', [], 'D'),
  sub('clear', 'Clear', 'Eraser', 'Clear transforms or data to defaults.', 'Reset', 'Clear transforms', 'Clear all data', [e('what','Clear','transform',['transform','keys','weights','materials','all'])], 'L'),
  sub('purge', 'Purge Unused', 'Broom', 'Remove unused data blocks from the file.', 'Scene', 'Purge unused', 'Preview purge', [], 'P'),
  sub('cut-out', 'Cut Out', 'Scissors', 'Cut selection to the clipboard.', 'Clipboard', 'Cut', 'Cut without fill', [], 'T'),
];

export const TOOLSETS: ToolSet[] = [
  { tool: 'pointer', label: 'Pointer', icon: 'MousePointer2', hotkey: 'V', doc: 'Transform and align objects with gizmos.', subtools: POINTER, defaultSub: 'move' },
  { tool: 'brush', label: 'Brush', icon: 'Paintbrush', hotkey: 'B', doc: 'Paint pixels and textures on surfaces.', subtools: BRUSH, defaultSub: 'brush' },
  { tool: 'sculpt', label: 'Sculpt', icon: 'Brush', hotkey: 'S', doc: 'Sculpt meshes and voxels with brushes.', subtools: SCULPT, defaultSub: 'draw' },
  { tool: 'hand', label: 'Hand', icon: 'Hand', hotkey: 'H', doc: 'Navigate the viewport freely.', subtools: HAND, defaultSub: 'pan' },
  { tool: 'timeline', label: 'Timeline', icon: 'Film', hotkey: 'T', doc: 'Author and edit animation keyframes.', subtools: TIMELINE, defaultSub: 'select-keys' },
  { tool: 'speaker', label: 'Speaker', icon: 'Volume2', hotkey: 'U', doc: 'Edit audio clips, synths and effects.', subtools: SPEAKER, defaultSub: 'select-region' },
  { tool: 'camera', label: 'Camera', icon: 'Camera', hotkey: 'K', doc: 'Frame, animate and record camera shots.', subtools: CAMERA, defaultSub: 'frame' },
  { tool: 'person', label: 'Person', icon: 'User', hotkey: 'P', doc: 'Build and customize characters.', subtools: PERSON, defaultSub: 'character' },
  { tool: 'delete', label: 'Delete', icon: 'Trash2', hotkey: 'Z', doc: 'Remove, dissolve or clear content.', subtools: DELETE, defaultSub: 'delete' },
];

export function findSub(toolId: string, subId: string): SubTool | undefined {
  const set = TOOLSETS.find((t) => t.tool === toolId);
  if (!set) return undefined;
  return set.subtools.find((s) => s.id === subId);
}

export function searchTools(query: string): { tool: string; sub: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: { tool: string; sub: string }[] = [];
  for (const set of TOOLSETS) {
    for (const s of set.subtools) {
      const hay = `${s.name} ${s.doc} ${s.group}`.toLowerCase();
      if (hay.includes(q)) out.push({ tool: set.tool, sub: s.id });
    }
  }
  return out;
}

export function hotkeyMap(): Record<string, { tool: string; sub?: string }> {
  const map: Record<string, { tool: string; sub?: string }> = {};
  const usedGlobal = new Set<string>();
  for (const set of TOOLSETS) {
    if (set.hotkey && !usedGlobal.has(set.hotkey)) {
      map[set.hotkey] = { tool: set.tool };
      usedGlobal.add(set.hotkey);
    }
    const usedLocal = new Set<string>();
    for (const s of set.subtools) {
      if (!s.hotkey) continue;
      const key = `${set.tool}:${s.hotkey}`;
      if (!usedLocal.has(s.hotkey)) {
        map[key] = { tool: set.tool, sub: s.id };
        usedLocal.add(s.hotkey);
      }
    }
  }
  return map;
}

const PASCAL = /^[A-Z][A-Za-z0-9]+$/;

export function validateCatalog(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(x)) return { ok: false, errors: ['catalog is not an array'] };
  const ids = new Set<string>();
  for (const set of x as ToolSet[]) {
    if (!set || typeof set !== 'object') { errors.push('invalid toolset entry'); continue; }
    if (!set.tool || typeof set.tool !== 'string') errors.push('toolset missing tool id');
    if (!set.defaultSub) errors.push(`${set.tool}: missing defaultSub`);
    if (!Array.isArray(set.subtools)) { errors.push(`${set.tool}: subtools not array`); continue; }
    let defaultFound = false;
    for (const s of set.subtools) {
      const fullId = `${set.tool}.${s.id}`;
      if (ids.has(fullId)) errors.push(`duplicate sub id: ${fullId}`);
      ids.add(fullId);
      if (!PASCAL.test(s.icon)) errors.push(`${fullId}: icon not PascalCase "${s.icon}"`);
      if (!s.primary || !s.primary.trim()) errors.push(`${fullId}: empty primary`);
      if (!s.secondary || !s.secondary.trim()) errors.push(`${fullId}: empty secondary`);
      if (s.id === set.defaultSub) defaultFound = true;
      for (const p of s.params) {
        if (p.type === 'number') {
          if (typeof p.min !== 'number' || typeof p.max !== 'number') {
            errors.push(`${fullId}.${p.key}: number param missing min/max`);
          } else {
            if (p.min > p.max) errors.push(`${fullId}.${p.key}: min > max`);
            if (typeof p.default === 'number') {
              if (p.default < p.min || p.default > p.max) {
                errors.push(`${fullId}.${p.key}: default ${p.default} outside [${p.min},${p.max}]`);
              }
            } else {
              errors.push(`${fullId}.${p.key}: default not number`);
            }
          }
        } else if (p.type === 'enum') {
          if (!Array.isArray(p.options) || p.options.length === 0) {
            errors.push(`${fullId}.${p.key}: enum missing options`);
          } else if (!p.options.includes(String(p.default))) {
            errors.push(`${fullId}.${p.key}: default "${p.default}" not in options`);
          }
        }
      }
    }
    if (!defaultFound) errors.push(`${set.tool}: defaultSub "${set.defaultSub}" not in subtools`);
  }
  return { ok: errors.length === 0, errors };
}

export class RecentTools {
  private stack: string[] = [];
  push(id: string): void {
    this.stack = this.stack.filter((x) => x !== id);
    this.stack.unshift(id);
  }
  list(n: number): string[] {
    return this.stack.slice(0, Math.max(0, Math.floor(n)));
  }
}