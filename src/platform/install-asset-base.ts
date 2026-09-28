/**
 * PLATFORM: imported first in main.tsx, so the asset rebasing is in place before any other module runs
 * (static imports are evaluated before main's own code; some modules load art as they load).
 */
import { installAssetBaseRewrite } from './asset-base';

installAssetBaseRewrite();
