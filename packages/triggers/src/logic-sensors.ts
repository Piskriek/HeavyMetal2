/** PLAN-43 Rung-1 trigger sensors for @hm/triggers: pure/deterministic. */
export type TriggerSensorKind = 'proximity' | 'stage-reached' | 'cardinal-threshold' | 'power-brownout' | 'leak-active' | 'hopper-low';
export interface SensorSpec { readonly id: string; readonly kind: TriggerSensorKind; readonly threshold?: number; readonly target?: string }
export interface ParamDescriptor { readonly key: string; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly defaultValue: number; readonly unit?: string; readonly group?: string }
export interface ParamSchema { readonly id: string; readonly version: number; readonly params: readonly ParamDescriptor[] }
const p = (key: string, label: string, min: number, max: number, step: number, defaultValue: number, unit?: string): ParamDescriptor => ({ key, label, min, max, step, defaultValue, ...(unit ? { unit } : {}), group: 'Sensor' });
export const TRIGGER_SENSOR_SCHEMA: ParamSchema = { id: 'hm.triggers.sensor', version: 1, params: [
  p('proximity', 'Proximity reading', 0, 1, 0.01, 0), p('stage-reached', 'Stage reached', 0, 6, 1, 0, 'stage'),
  p('cardinal-threshold', 'Cardinal value', -1000, 1000, 1, 0), p('power-brownout', 'Power ratio (active below threshold)', 0, 1, 0.01, 1, 'ratio'),
  p('leak-active', 'Leak active', 0, 1, 1, 0), p('hopper-low', 'Hopper level (active below threshold)', 0, 1, 0.01, 1, 'ratio'), p('threshold', 'Threshold', -1000, 1000, 0.01, 1)] };
export const SENSOR_KINDS: readonly TriggerSensorKind[] = ['proximity', 'stage-reached', 'cardinal-threshold', 'power-brownout', 'leak-active', 'hopper-low'];
export function validateSensorSpec(s: SensorSpec): string[] { const e: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) e.push(`sensor id must be a lowercase slug, got "${s.id}"`);
  if (!SENSOR_KINDS.includes(s.kind)) e.push(`unknown sensor kind "${s.kind as string}"`);
  if (s.threshold !== undefined && !Number.isFinite(s.threshold)) e.push(`sensor "${s.id}" threshold must be finite`); return e; }
export const validateTriggerSensor = validateSensorSpec;
/** Numeric sensor value; brownout/hopper-low invert (active when reading <= threshold). */
export function evaluateSensor(spec: SensorSpec, reading: number): number {
  if (!Number.isFinite(reading)) return 0; const t = spec.threshold ?? 1;
  return spec.kind === 'power-brownout' || spec.kind === 'hopper-low' ? (reading <= t ? 1 : 0) : reading; }
export function isSensorActive(spec: SensorSpec, reading: number): boolean {
  const v = evaluateSensor(spec, reading);
  return spec.kind === 'power-brownout' || spec.kind === 'hopper-low' ? v === 1 : v >= (spec.threshold ?? 1); }
export const evaluateTriggerSensor = evaluateSensor;
