export const simulatorHistoryKey = 'monaddesign.simulator-history.v1';

export type SimulatorHistory = Record<string, string[]>;

export type SortableSimulator = {
  udid: string;
  state: 'Booted' | 'Shutdown';
  connected?: boolean;
};

export const parseSimulatorHistory = (value: string | null): SimulatorHistory => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
        .map(([projectId, udids]) => [
          projectId,
          udids.filter((udid): udid is string => typeof udid === 'string' && udid.length > 0)
        ])
    );
  } catch {
    return {};
  }
};

export const recordUsedSimulator = (history: SimulatorHistory, projectId: string, udid: string): SimulatorHistory => ({
  ...history,
  [projectId]: [udid, ...(history[projectId] ?? []).filter((item) => item !== udid)]
});

export const sortSimulatorsForProject = <Simulator extends SortableSimulator>(
  simulators: Simulator[],
  usedUdids: string[]
): Simulator[] => {
  const usedOrder = new Map(usedUdids.map((udid, index) => [udid, index]));
  return simulators
    .map((simulator, index) => ({ simulator, index }))
    .sort((left, right) => {
      const connectionOrder = Number(Boolean(right.simulator.connected)) - Number(Boolean(left.simulator.connected));
      if (connectionOrder) return connectionOrder;

      const leftUsed = usedOrder.get(left.simulator.udid);
      const rightUsed = usedOrder.get(right.simulator.udid);
      if (leftUsed !== undefined || rightUsed !== undefined) {
        if (leftUsed === undefined) return 1;
        if (rightUsed === undefined) return -1;
        if (leftUsed !== rightUsed) return leftUsed - rightUsed;
      }
      const bootOrder = Number(right.simulator.state === 'Booted') - Number(left.simulator.state === 'Booted');
      if (bootOrder) return bootOrder;
      return left.index - right.index;
    })
    .map(({ simulator }) => simulator);
};
