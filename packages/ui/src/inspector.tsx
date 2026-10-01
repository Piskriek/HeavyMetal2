import type { ReactElement } from 'react';
import type { InspectorInput } from './model';

/** Placeholder until the React component is written (UI task). */
export function Inspector(_props: InspectorInput & { onChange: (key: string, value: unknown) => void; onReset?: (key: string) => void }): ReactElement {
  throw new Error('@hm/ui: Inspector is not implemented yet');
}
