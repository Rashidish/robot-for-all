// The name of each topic family, in the page's language.
import { m } from '../i18n';
import type { MachineFamily } from './schema';

const NAMES: Record<MachineFamily, () => string> = {
  gears: () => m.machines_family_gears(),
  levers: () => m.machines_family_levers(),
  linkages: () => m.machines_family_linkages(),
  'cams-cranks': () => m.machines_family_cams_cranks(),
  pulleys: () => m.machines_family_pulleys(),
  'wheels-bearings': () => m.machines_family_wheels_bearings(),
  'springs-dampers': () => m.machines_family_springs_dampers(),
  fasteners: () => m.machines_family_fasteners()
};

export function familyName(family: MachineFamily): string {
  return NAMES[family]();
}
