// Which rfa_robot.py a program gets (ADR-0008). On screen: the simulator profile, the same for
// every board, so the robot world behaves the same whichever board the learner picked. In the
// .hex for a real micro:bit: the module made for the learner's board and "Test my robot" fixes.
import basic from '../../../../content/robots/l9110s-basic.json';
import {
  buildProfile,
  type Fixes,
  type Profile,
  rfaRobotPy,
  SIMULATOR_RFA_ROBOT_PY
} from '../../../../packages/robots/src/index';

/** The learner's board until "My robot" setup exists: the recommended cheapest build. */
export const DEFAULT_PROFILE: Profile = buildProfile(basic);

/** Our modules for the on-screen micro:bit ('screen') or a real one ('board'). */
export function modulesFor(
  target: 'screen' | 'board',
  profile: Profile = DEFAULT_PROFILE,
  fixes: Fixes = {}
): Record<string, string> {
  return { rfa_robot: target === 'screen' ? SIMULATOR_RFA_ROBOT_PY : rfaRobotPy(profile, fixes) };
}
