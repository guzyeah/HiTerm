export type ProtocolType = 'ssh' | 'local' | 'telnet' | 'serial' | 'vnc' | 'rdp'

export interface ShellSummary {
  id: string
  protocol: ProtocolType
  name: string
  group: string | null
}
