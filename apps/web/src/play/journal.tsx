// The journal (TASK-22): the Esc menu's page for the campaign chain. It lists every act and step, marks what is done, what is
// current (with its hint and its progress) and what is still to come, and shows the plot's own goal. Pure presentation:
// the screen (play.tsx) passes the rows and does the actions. Styled as the game's telemetry log (play.css, .journal).
import type { ReactElement } from 'react';
import { CHAIN, CHAIN_STEPS, chainView, finishedSteps, stepProgress, type Chain } from '../base/campaign-chain';

export interface JournalProps {
  readonly chain: Chain;
  /** The plot's own goal (the fidelity stage), shown above the acts. */
  readonly plotTitle: string;
  readonly plotHint: string;
  readonly counts: Readonly<Record<string, number>>;
  /** Opens the Studio. Passed only where the Studio can be reached. */
  readonly onStudio?: () => void;
  readonly onClose: () => void;
}

type Mark = 'done' | 'current' | 'todo';

export function Journal(props: JournalProps): ReactElement {
  const view = chainView(props.chain);
  const done = finishedSteps(props.chain.progress);
  const started = props.chain.progress.quest !== null || done.length > 0;
  const markOf = (id: string): Mark => (done.includes(id) ? 'done' : view.current?.id === id ? 'current' : 'todo');
  return (
    <section className="journal" aria-label="Journal" data-testid="journal">
      <header className="journal-head">
        <h3>Journal</h3>
        <button type="button" className="journal-close" onClick={props.onClose}>Back</button>
      </header>

      <div className="journal-plot">
        <span>Plot</span>
        <b>{props.plotTitle}</b>
        <p>{props.plotHint}</p>
      </div>

      {!started ? (
        <p className="journal-wait">The chain starts once the drill runs. Feed your mill first.</p>
      ) : null}

      {started ? CHAIN.quests.map((q) => {
        const steps = CHAIN_STEPS.filter((s) => s.quest === q.id);
        const actDone = props.chain.progress.finished.includes(q.id);
        return (
          <section key={q.id} className={`journal-act${actDone ? ' done' : ''}`} aria-label={q.title}>
            <h4>{q.title}{actDone ? <em> done</em> : null}</h4>
            <ol>
              {steps.map((s) => {
                const mark = markOf(s.id);
                const progress = mark === 'done' ? '' : stepProgress(s, props.counts);
                return (
                  <li key={s.id} className={`journal-step ${mark}`} data-step={s.id} aria-current={mark === 'current' ? 'step' : undefined}>
                    <i aria-hidden="true" />
                    <div className="journal-step-body">
                      <div className="journal-step-line">
                        <b>{s.title}</b>
                        <code>{s.id}</code>
                        {progress ? <span className="journal-progress">{progress}</span> : null}
                      </div>
                      {mark === 'current' ? (
                        <>
                          <p className="journal-hint">{s.hint}</p>
                          {s.id === 'A4-03' && props.onStudio ? (
                            <button type="button" className="journal-studio" onClick={props.onStudio}>Open the Studio</button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      }) : null}
      {view.next && started ? <p className="journal-next">Next: {view.next.title}</p> : null}
    </section>
  );
}
