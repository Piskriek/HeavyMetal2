import { useEffect, useMemo, useRef } from "react";
import { evaluateGraph, litPreview, type TexGraph, type EvaluateOptions } from "@/engine/texgraph";

export type Channel = "lit" | "albedo" | "height" | "roughness" | "normal";

export function useEvaluated(graph: TexGraph, opts: EvaluateOptions) {
  return useMemo(() => {
    const t0 = performance.now();
    const tex = evaluateGraph(graph, opts);
    return { tex, ms: performance.now() - t0 };
  }, [graph, opts.size, opts.seed, opts.relief, opts.normal]);
}

/** Renders an EvaluatedTexture. `display` is the CSS pixel size; the
 *  texture is upscaled nearest-neighbour so low Pxd is honestly chunky. */
export default function TexCanvas({
  graph,
  opts,
  channel = "lit",
  className,
  smooth = false,
}: {
  graph: TexGraph;
  opts: EvaluateOptions;
  channel?: Channel;
  className?: string;
  smooth?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { tex } = useEvaluated(graph, opts);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const s = tex.size;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const oc = off.getContext("2d")!;
    const img = oc.createImageData(s, s);

    if (channel === "lit") {
      img.data.set(litPreview(tex));
    } else {
      const px = s * s;
      for (let i = 0; i < px; i++) {
        let r = 0,
          g = 0,
          b = 0;
        if (channel === "albedo" && tex.albedo) {
          r = tex.albedo[i * 3] * 255;
          g = tex.albedo[i * 3 + 1] * 255;
          b = tex.albedo[i * 3 + 2] * 255;
        } else if (channel === "height" && tex.height) {
          r = g = b = tex.height[i] * 255;
        } else if (channel === "roughness" && tex.roughness) {
          r = g = b = tex.roughness[i] * 255;
        } else if (channel === "normal" && tex.normal) {
          r = (tex.normal[i * 2] * 0.5 + 0.5) * 255;
          g = (tex.normal[i * 2 + 1] * 0.5 + 0.5) * 255;
          b = 255;
        }
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
      }
    }
    oc.putImageData(img, 0, 0);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = cv.getBoundingClientRect();
    const w = Math.max(32, Math.round(rect.width * dpr));
    cv.width = w;
    cv.height = w;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = smooth;
    ctx.clearRect(0, 0, w, w);
    ctx.drawImage(off, 0, 0, s, s, 0, 0, w, w);
  }, [tex, channel, smooth]);

  return <canvas ref={ref} className={className} style={{ aspectRatio: "1 / 1", width: "100%" }} />;
}
