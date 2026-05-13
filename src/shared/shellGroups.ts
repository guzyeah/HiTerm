export const DEFAULT_SHELL_GROUP_NAME = 'Default'
export const LOCAL_SHELL_GROUP_NAME = 'Local'

export const PRESET_SHELL_GROUP_NAMES = [
  DEFAULT_SHELL_GROUP_NAME,
  LOCAL_SHELL_GROUP_NAME,
] as const

export type PresetShellGroupName = (typeof PRESET_SHELL_GROUP_NAMES)[number]

export const SHELL_GROUP_I18N_KEYS: Record<PresetShellGroupName, string> = {
  [DEFAULT_SHELL_GROUP_NAME]: 'shellGroups.default',
  [LOCAL_SHELL_GROUP_NAME]: 'shellGroups.local',
}

export function isPresetShellGroupName(name: string): name is PresetShellGroupName {
  return PRESET_SHELL_GROUP_NAMES.includes(name as PresetShellGroupName)
}
