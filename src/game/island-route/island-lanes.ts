/**
 * ISLAND-ROUTE: the island course's starting lane network (the lane tool's own format, lane-network.ts).
 * Three lanes down the middle of the groove, where its floor is level: left, centre and right, from the
 * start line to the finish. It is what the island races on until the owner saves a network of their own
 * in the builder's Lanes tab, which then replaces it.
 */
import { validateLaneNetwork, type LaneNetwork, type LaneNode, type LanePath } from '../lane-network';
import { FINISH, START_X } from '../scene';

/** Engine z of the three lanes (±443 is the edge of the track; the groove floor holds about ±320). */
export const ISLAND_LANE_Z: readonly number[] = [-290, 0, 290];
/** Each lane's half-width in engine z (the lane tool allows 40..240). */
export const ISLAND_LANE_HALF_WIDTH = 110;
/** Engine x between nodes. */
const NODE_SPACING = 600;

export function islandLaneNetwork(): LaneNetwork {
  const xs: number[] = [];
  for (let x = START_X; x < FINISH; x += NODE_SPACING) xs.push(x);
  xs.push(FINISH);
  const nodes: LaneNode[] = [];
  const paths: LanePath[] = [];
  const names = ['Left groove', 'Centre groove', 'Right groove'];
  ISLAND_LANE_Z.forEach((z, lane) => {
    const nodeIds = xs.map((x) => {
      const id = `groove${lane + 1}-x${x}`;
      nodes.push({ id, x, z, kind: 'normal' });
      return id;
    });
    paths.push({ id: `groove-${lane + 1}`, name: names[lane], nodeIds, halfWidth: ISLAND_LANE_HALF_WIDTH });
  });
  const network: LaneNetwork = { version: 1, course: 'basalt', nodes, paths };
  const check = validateLaneNetwork(network);
  if (!check.ok) throw new Error(`island lanes do not validate: ${JSON.stringify(check.errors[0])}`);
  return network;
}
