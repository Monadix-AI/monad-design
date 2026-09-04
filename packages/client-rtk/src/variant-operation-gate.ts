export const createVariantOperationGate = () => {
  let generation = 0;
  let sequence = 0;
  let operation: { generation: number; id: number; name: string } | null = null;

  return {
    begin(nextOperation: string) {
      if (operation) return null;
      sequence += 1;
      operation = { generation, id: sequence, name: nextOperation };
      return operation;
    },
    finish(token: { generation: number; id: number }) {
      if (token.generation !== generation || operation?.id !== token.id) return false;
      operation = null;
      return true;
    },
    isCurrent(token: { generation: number; id: number }) {
      return token.generation === generation && operation?.id === token.id;
    },
    reset() {
      generation += 1;
      operation = null;
    }
  };
};
