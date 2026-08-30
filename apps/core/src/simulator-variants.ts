export const simulatorVariantIds = ['original', 'v1', 'v2', 'v3', 'v4', 'v5'] as const;

export type SimulatorVariantId = (typeof simulatorVariantIds)[number];

const bundleIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$/;

export const assertBundleIdentifier = (bundleId: unknown): string => {
  if (
    typeof bundleId !== 'string' ||
    bundleId.length > 255 ||
    !bundleIdentifierPattern.test(bundleId) ||
    !bundleId.includes('.')
  ) {
    throw new Error('Enter a valid app bundle identifier, such as com.example.app.');
  }

  return bundleId;
};

export const assertSimulatorVariantId = (variant: unknown): SimulatorVariantId => {
  if (typeof variant !== 'string' || !simulatorVariantIds.includes(variant as SimulatorVariantId)) {
    throw new Error('The requested preview variant is not supported.');
  }

  return variant as SimulatorVariantId;
};

export const simulatorVariantLaunchArguments = (udid: string, bundleId: string, variant: SimulatorVariantId) => [
  'simctl',
  'launch',
  '--terminate-running-process',
  udid,
  bundleId,
  '-MonadDesignVariant',
  variant
];

export const simulatorAppLaunchArguments = (udid: string, bundleId: string) => [
  'simctl',
  'launch',
  '--terminate-running-process',
  udid,
  bundleId
];

export const simulatorAppContainerArguments = (udid: string, bundleId: string) => [
  'simctl',
  'get_app_container',
  udid,
  bundleId,
  'app'
];
