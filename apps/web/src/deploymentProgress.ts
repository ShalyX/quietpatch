export type DeploymentStage = 'prepare' | 'prove' | 'balance' | 'submit' | 'confirm' | 'save';

export const deploymentStageLabels: Record<DeploymentStage, string> = {
  prepare: 'Preparing contract',
  prove: 'Preparing deployment proof',
  balance: 'Waiting for Lace to approve and balance fees',
  submit: 'Submitting through Lace',
  confirm: 'Waiting for Midnight confirmation',
  save: 'Saving contract access in this browser'
};

// Bind untouched methods to their original instance: providers may use private fields.
// Observe calls only; never retry a transaction or impose a timeout on a submission.
export function observeProvider<T extends object>(
  provider: T,
  stages: Partial<Record<keyof T, DeploymentStage>>,
  onStage: (stage: DeploymentStage) => void
): T {
  return new Proxy(provider, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const stage = stages[key as keyof T];
        if (stage) onStage(stage);
        return Reflect.apply(value, target, args);
      };
    }
  });
}
