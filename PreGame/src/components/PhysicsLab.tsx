import { useEffect, useRef, useState } from 'react';
import { FlaskConical, Play, Check, X, LoaderCircle, ArrowUpRight } from 'lucide-react';
import Dialog from './Dialog';

interface CheckResult { name: string; status: 'pending' | 'running' | 'pass' | 'fail'; detail?: string }

export default function PhysicsLab({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async () => {
    setRunning(true);
    setResults([]);
    const start = performance.now();
    try {
      const { regressionChecks } = await import('../game/regressions');
      const next: CheckResult[] = regressionChecks.map((test) => ({ name: test.name, status: 'pending' }));
      if (!mounted.current) return;
      setResults([...next]);
      for (let i = 0; i < regressionChecks.length; i++) {
        if (!mounted.current) break;
        next[i] = { ...next[i], status: 'running' };
        setResults([...next]);
        await new Promise((resolve) => setTimeout(resolve, 15));
        try {
          const detail = await regressionChecks[i].run();
          next[i] = { ...next[i], status: 'pass', detail };
        } catch (error) {
          next[i] = { ...next[i], status: 'fail', detail: error instanceof Error ? error.message : String(error) };
        }
        if (mounted.current) { setResults([...next]); setElapsed((performance.now() - start) / 1000); }
      }
    } catch (error) {
      if (mounted.current) setResults([{ name: 'Load regression suite', status: 'fail', detail: String(error) }]);
    } finally { if (mounted.current) setRunning(false); }
  };
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  return <Dialog onClose={onClose} titleId="lab-title" className="lab-dialog">
    <span className="eyebrow"><FlaskConical size={15} /> ENGINEERING / QUALITY ASSURANCE</span>
    <h2 id="lab-title">The physics lab.</h2>
    <p className="dialog-intro">Real simulations. Reproducible results. Run the same regression checks that protect every production build.</p>
    <div className="lab-toolbar">
      <button className="button-primary" onClick={run} disabled={running}>{running ? <LoaderCircle className="spinning" size={17} /> : <Play size={16} />}{running ? 'Testing the engine' : results.length ? 'Run tests again' : 'Run regression tests'}</button>
      <span className="lab-summary" role="status" aria-live="polite">{results.length ? `${passed}/${results.length} passed${failed ? `, ${failed} failed` : ''} / ${elapsed.toFixed(1)}s` : 'Ready when you are'}</span>
    </div>
    {results.length ? <ol className="test-list">{results.map((result, i) => <li key={result.name} className={`test-${result.status}`}>
      <span className="test-indicator">{result.status === 'pass' ? <Check size={16} /> : result.status === 'fail' ? <X size={16} /> : result.status === 'running' ? <LoaderCircle size={16} className="spinning" /> : String(i + 1).padStart(2, '0')}</span>
      <div><strong>{result.name}</strong>{result.detail && <p>{result.detail}</p>}</div>
      <span className="test-state">{result.status}</span>
    </li>)}</ol> : <div className="lab-empty"><FlaskConical size={36} /><h3>No green checks without a test.</h3><p>Shallow ramps, gravity starts, collisions, freeze timing, trapped marbles, six full circuits, and championship scoring.</p></div>}
    <footer className="dialog-footnote"><code>node scripts/check.mjs</code><span>Also runs automatically on build <ArrowUpRight size={13} /></span></footer>
  </Dialog>;
}