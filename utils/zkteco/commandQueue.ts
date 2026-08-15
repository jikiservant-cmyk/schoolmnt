// Helper storage for pending ZKTeco ADMS device commands

export const pendingDeviceCommands: Map<string, Array<{ id: number; cmd: string }>> = new Map();

// Helper to enqueue a command for all registered devices or a specific SN
export function enqueueDeviceCommand(cmd: string, targetSn?: string) {
  const cmdId = Math.floor(Date.now() % 1000000);
  const formatted = `C:${cmdId}:${cmd}`;
  
  if (targetSn) {
    const list = pendingDeviceCommands.get(targetSn) || [];
    list.push({ id: cmdId, cmd: formatted });
    pendingDeviceCommands.set(targetSn, list);
  } else {
    // Broadcast key
    const list = pendingDeviceCommands.get('ALL') || [];
    list.push({ id: cmdId, cmd: formatted });
    pendingDeviceCommands.set('ALL', list);
  }
}
