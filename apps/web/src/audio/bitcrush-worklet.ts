// The bit-depth mirror (DEC-07, TASK-29 part A): a sample-and-hold rate reducer and a bit quantiser, as an AudioWorklet.
// It sits on the world SFX bus only (never on voice, combat and UI, or music). Its module is an inline string, loaded from a
// data: URL, so the single built file works over http and when opened from disk: no second file to fetch. (A Blob URL is
// refused by Chrome when the page is opened from disk: 'blob:null ... failed to load', checked 18 October 2026.)

/** The processor's registered name. */
export const BITCRUSH_PROCESSOR = 'hm-bitcrush';

/**
 * The worklet's module. Two k-rate parameters: `rate` (Hz; at or above the context's sample rate it holds nothing back) and
 * `bits` (16 keeps every bit). Each sample is quantised to 2^(bits-1) steps either side of zero, and the held value is
 * refreshed at the rate's phase, so 8 kHz holds each sample for six frames at 48 kHz.
 */
export const BITCRUSH_SOURCE = `
class HmBitcrush extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 48000, minValue: 1000, maxValue: 192000, automationRate: 'k-rate' },
      { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.phase = 0;
    this.held = new Float32Array(8);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const rate = parameters.rate[0];
    const bits = Math.round(parameters.bits[0]);
    const step = Math.pow(2, bits - 1);
    const inc = Math.min(1, rate / sampleRate);
    const bypass = inc >= 1 && bits >= 16;
    const chans = Math.min(output.length, 8);
    const frames = output[0].length;
    for (let i = 0; i < frames; i++) {
      this.phase += inc;
      if (this.phase >= 1) {
        this.phase -= 1;
        for (let c = 0; c < chans; c++) {
          const src = input && input.length ? input[Math.min(c, input.length - 1)] : null;
          const x = src ? src[i] : 0;
          this.held[c] = bits >= 16 ? x : Math.round(x * step) / step;
        }
      }
      for (let c = 0; c < output.length; c++) {
        const src = input && input.length ? input[Math.min(c, input.length - 1)] : null;
        output[c][i] = bypass ? (src ? src[i] : 0) : (c < 8 ? this.held[c] : 0);
      }
    }
    return true;
  }
}
registerProcessor('${BITCRUSH_PROCESSOR}', HmBitcrush);
`;

/** The worklet module as a data: URL (no revoke needed). */
export function bitcrushModuleUrl(): string {
  return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(BITCRUSH_SOURCE);
}
