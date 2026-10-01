/**
 * The deployable shell. It must always build to one static html file and show which packages are implemented.
 * Tasks may wire their package into this page (a small demo/status panel), but must never break `npm run build`.
 */
import { FORMAT_VERSION, SIM_HZ } from '@hm/contracts';
import * as kernel from '@hm/kernel';
import * as sim from '@hm/sim';
import * as platform from '@hm/platform';

function status(name: string, probe: () => unknown): string {
  try {
    probe();
    return `<li class="ok">${name}: implemented</li>`;
  } catch (e) {
    return /not implemented/.test(String(e)) ? `<li class="todo">${name}: not implemented yet</li>` : `<li class="todo">${name}: error - ${String(e).slice(0, 120)}</li>`;
  }
}

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `<h1>HM Harness</h1><p>format v${FORMAT_VERSION}, sim ${SIM_HZ} Hz</p><ul>${[
    status('kernel', () => kernel.createSchemaRegistry()),
    '<li class="todo">script: implemented (QuickJS sandbox, 13 tests); not wired into the browser shell yet: its type-checker needs a browser-safe split</li>',
    status('sim', () => sim.createRng(1)),
    status('platform', () => platform.createPlatform('stub')),
  ].join('')}</ul>`;
}
