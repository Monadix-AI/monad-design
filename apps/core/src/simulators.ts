import type { SimulatorOrientation } from '@monaddesign/simulator';

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import {
  assertBundleIdentifier,
  assertSimulatorVariantId,
  simulatorAppContainerArguments,
  simulatorAppLaunchArguments,
  simulatorVariantLaunchArguments
} from './simulator-variants';

const execFileAsync = promisify(execFile);

export interface IOSSimulator {
  udid: string;
  name: string;
  runtime: string;
  state: 'Booted' | 'Shutdown';
  connected: boolean;
  deviceTypeIdentifier?: string;
  productFamily?: string;
  modelIdentifier?: string;
  chromeIdentifier?: string;
  screen?: { width: number; height: number; scale: number };
  framebufferMask?: string;
  deviceChrome?: {
    image: string;
    frame: { width: number; height: number };
    body: { x: number; y: number; width: number; height: number };
    screen: { x: number; y: number; width: number; height: number };
    insets: { top: number; right: number; bottom: number; left: number };
  };
}

export type { SimulatorOrientation } from '@monaddesign/simulator';

export const parseSimulatorOrientation = (value: string): SimulatorOrientation | null => {
  const storedValue = /GraphicsOrientation\s*=\s*([1-4])\s*;/.exec(value)?.[1] ?? value.trim();
  switch (storedValue) {
    case '1':
      return 'portrait';
    case '2':
      return 'portrait_upside_down';
    case '3':
      return 'landscape_left';
    case '4':
      return 'landscape_right';
    default:
      return null;
  }
};

export const readSimulatorOrientation = async (udid: string): Promise<SimulatorOrientation> => {
  try {
    const { stdout } = await execFileAsync('xcrun', [
      'simctl',
      'spawn',
      udid,
      'defaults',
      'read',
      'com.apple.backboardd'
    ]);
    return parseSimulatorOrientation(stdout) ?? 'portrait';
  } catch {
    return 'portrait';
  }
};

interface SimctlDevice {
  deviceTypeIdentifier?: unknown;
  name?: unknown;
  state?: unknown;
  udid?: unknown;
}

interface SimctlDeviceType {
  bundlePath?: unknown;
  identifier?: unknown;
  modelIdentifier?: unknown;
  productFamily?: unknown;
}

interface SimctlDeviceTypeList {
  devicetypes?: SimctlDeviceType[];
}

interface SimulatorProfile {
  chromeIdentifier?: unknown;
  framebufferMask?: unknown;
  mainScreenHeight?: unknown;
  mainScreenScale?: unknown;
  mainScreenWidth?: unknown;
  modelIdentifier?: unknown;
}

interface DeviceChromeProfile {
  identifier?: unknown;
  images?: {
    composite?: unknown;
    devicePadding?: {
      bottom?: unknown;
      left?: unknown;
      right?: unknown;
      top?: unknown;
    };
  };
}

interface ResolvedDeviceType {
  bundlePath: string;
  identifier: string;
  modelIdentifier?: string;
  productFamily?: string;
}

const profileCache = new Map<
  string,
  Promise<
    Pick<
      IOSSimulator,
      'chromeIdentifier' | 'deviceChrome' | 'framebufferMask' | 'modelIdentifier' | 'productFamily' | 'screen'
    >
  >
>();

const rasterizedPdf = async (sourcePath: string, prefix: string) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), prefix));
  try {
    const outputPath = join(temporaryDirectory, 'asset.png');
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', sourcePath, '--out', outputPath]);
    return `data:image/png;base64,${(await readFile(outputPath)).toString('base64')}`;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

const pdfSize = async (sourcePath: string) => {
  const { stdout } = await execFileAsync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', sourcePath], {
    encoding: 'utf8'
  });
  const width = Number(/pixelWidth:\s*([\d.]+)/.exec(stdout)?.[1]);
  const height = Number(/pixelHeight:\s*([\d.]+)/.exec(stdout)?.[1]);
  return width > 0 && height > 0 ? { width, height } : null;
};

export const deviceChromeGeometry = ({
  bodySize,
  devicePadding,
  screenSize
}: {
  bodySize: { width: number; height: number };
  devicePadding: { top: number; right: number; bottom: number; left: number };
  screenSize: { width: number; height: number };
}) => {
  const body = {
    x: devicePadding.left,
    y: devicePadding.top,
    width: bodySize.width,
    height: bodySize.height
  };
  const frame = {
    width: bodySize.width + devicePadding.left + devicePadding.right,
    height: bodySize.height + devicePadding.top + devicePadding.bottom
  };
  const screen = {
    x: body.x + (body.width - screenSize.width) / 2,
    y: body.y + (body.height - screenSize.height) / 2,
    width: screenSize.width,
    height: screenSize.height
  };
  return {
    frame,
    body,
    screen,
    insets: {
      top: screen.y,
      right: frame.width - screen.x - screen.width,
      bottom: frame.height - screen.y - screen.height,
      left: screen.x
    }
  };
};

const resolveDeviceChrome = async (
  chromeIdentifier: string,
  screenSize: { width: number; height: number }
): Promise<IOSSimulator['deviceChrome']> => {
  const chromeName = chromeIdentifier.split('.').at(-1);
  if (!chromeName || !/^[A-Za-z0-9_-]+$/.test(chromeName)) return undefined;

  const resourcesPath = join(
    '/Library/Developer/DeviceKit/Chrome',
    `${chromeName}.devicechrome`,
    'Contents',
    'Resources'
  );
  const profile = JSON.parse(await readFile(join(resourcesPath, 'chrome.json'), 'utf8')) as DeviceChromeProfile;
  const composite = profile.images?.composite;
  if (profile.identifier !== chromeIdentifier || typeof composite !== 'string' || basename(composite) !== composite) {
    return undefined;
  }

  const sourcePath = join(resourcesPath, `${composite}.pdf`);
  const bodySize = await pdfSize(sourcePath);
  if (!bodySize) return undefined;
  const rawPadding = profile.images?.devicePadding;
  const devicePadding = {
    top: Number(rawPadding?.top ?? 0),
    right: Number(rawPadding?.right ?? 0),
    bottom: Number(rawPadding?.bottom ?? 0),
    left: Number(rawPadding?.left ?? 0)
  };
  if (Object.values(devicePadding).some((inset) => !Number.isFinite(inset) || inset < 0)) {
    return undefined;
  }
  const geometry = deviceChromeGeometry({ bodySize, devicePadding, screenSize });
  if (Object.values(geometry.insets).some((inset) => !Number.isFinite(inset) || inset < 0)) return undefined;

  return {
    image: await rasterizedPdf(sourcePath, 'monadesign-device-chrome-'),
    ...geometry
  };
};

interface SimctlDeviceList {
  devices?: Record<string, SimctlDevice[]>;
}

const runtimeName = (identifier: string) => {
  const runtime = identifier.split('SimRuntime.').at(-1) ?? identifier;
  return runtime.replaceAll('-', ' ').replace(/(\d) (\d)/g, '$1.$2');
};

export const parseAvailableSimulators = (output: string): IOSSimulator[] => {
  const parsed = JSON.parse(output) as SimctlDeviceList;

  return Object.entries(parsed.devices ?? {}).flatMap(([runtime, devices]) =>
    devices.flatMap((device) => {
      if (
        (device.state !== 'Booted' && device.state !== 'Shutdown') ||
        typeof device.name !== 'string' ||
        typeof device.udid !== 'string'
      ) {
        return [];
      }

      return [
        {
          udid: device.udid,
          name: device.name,
          runtime: runtimeName(runtime),
          state: device.state,
          connected: false,
          deviceTypeIdentifier:
            typeof device.deviceTypeIdentifier === 'string' ? device.deviceTypeIdentifier : undefined
        }
      ];
    })
  );
};

export const markConnectedSimulator = (simulators: IOSSimulator[], connectedUdid: string | null) =>
  simulators.map((simulator) => ({
    ...simulator,
    connected: simulator.udid === connectedUdid
  }));

const parseDeviceTypes = (output: string) => {
  const parsed = JSON.parse(output) as SimctlDeviceTypeList;
  return new Map(
    (parsed.devicetypes ?? []).flatMap((deviceType) =>
      typeof deviceType.bundlePath === 'string' && typeof deviceType.identifier === 'string'
        ? [
            [
              deviceType.identifier,
              {
                bundlePath: deviceType.bundlePath,
                identifier: deviceType.identifier,
                modelIdentifier:
                  typeof deviceType.modelIdentifier === 'string' ? deviceType.modelIdentifier : undefined,
                productFamily: typeof deviceType.productFamily === 'string' ? deviceType.productFamily : undefined
              }
            ] as const
          ]
        : []
    )
  );
};

const resolveDeviceProfile = (deviceType: ResolvedDeviceType) => {
  const cached = profileCache.get(deviceType.identifier);
  if (cached) return cached;

  const resolution = (async () => {
    const resourcesPath = join(deviceType.bundlePath, 'Contents', 'Resources');
    const { stdout } = await execFileAsync(
      '/usr/bin/plutil',
      ['-convert', 'json', '-o', '-', join(resourcesPath, 'profile.plist')],
      { encoding: 'utf8' }
    );
    const profile = JSON.parse(stdout) as SimulatorProfile;
    let framebufferMask: string | undefined;
    if (typeof profile.framebufferMask === 'string') {
      try {
        framebufferMask = await rasterizedPdf(
          join(resourcesPath, `${profile.framebufferMask}.pdf`),
          'monadesign-framebuffer-mask-'
        );
      } catch {
        // Keep the exact screen metadata even if this Xcode cannot rasterize its mask.
      }
    }
    const width = Number(profile.mainScreenWidth);
    const height = Number(profile.mainScreenHeight);
    const scale = Number(profile.mainScreenScale);
    const screen = width > 0 && height > 0 && scale > 0 ? { width, height, scale } : undefined;
    const chromeIdentifier = typeof profile.chromeIdentifier === 'string' ? profile.chromeIdentifier : undefined;
    const deviceChrome =
      chromeIdentifier && screen
        ? await resolveDeviceChrome(chromeIdentifier, {
            width: screen.width / screen.scale,
            height: screen.height / screen.scale
          }).catch(() => undefined)
        : undefined;
    return {
      productFamily: deviceType.productFamily,
      modelIdentifier:
        typeof profile.modelIdentifier === 'string' ? profile.modelIdentifier : deviceType.modelIdentifier,
      chromeIdentifier,
      deviceChrome,
      framebufferMask,
      screen
    };
  })();
  profileCache.set(deviceType.identifier, resolution);
  return resolution;
};

export const listAvailableSimulators = async (connectedUdid: string | null = null) => {
  const [{ stdout: devicesOutput }, { stdout: deviceTypesOutput }] = await Promise.all([
    execFileAsync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8', timeout: 10_000 }),
    execFileAsync('xcrun', ['simctl', 'list', 'devicetypes', '--json'], {
      encoding: 'utf8',
      timeout: 10_000
    })
  ]);
  const deviceTypes = parseDeviceTypes(deviceTypesOutput);
  const simulators = await Promise.all(
    parseAvailableSimulators(devicesOutput).map(async (simulator) => {
      const deviceType = simulator.deviceTypeIdentifier ? deviceTypes.get(simulator.deviceTypeIdentifier) : undefined;
      if (!deviceType) return simulator;
      try {
        return { ...simulator, ...(await resolveDeviceProfile(deviceType)) };
      } catch {
        return {
          ...simulator,
          modelIdentifier: deviceType.modelIdentifier,
          productFamily: deviceType.productFamily
        };
      }
    })
  );
  return markConnectedSimulator(simulators, connectedUdid);
};

export const ensureSimulatorBooted = async (udid: string) => {
  const simulator = (await listAvailableSimulators()).find((item) => item.udid === udid);
  if (!simulator) throw new Error('The selected simulator is not available.');
  if (simulator.state === 'Booted') return simulator;

  await execFileAsync('xcrun', ['simctl', 'boot', udid], { timeout: 20_000 });
  await execFileAsync('xcrun', ['simctl', 'bootstatus', udid, '-b'], {
    timeout: 120_000
  });
  return { ...simulator, state: 'Booted' as const };
};

export const captureSimulatorScreen = async (udid: string) => {
  const simulators = await listAvailableSimulators();
  if (!simulators.some((simulator) => simulator.udid === udid)) {
    throw new Error('The selected simulator is no longer running.');
  }

  const screenshotPath = join(tmpdir(), `monaddesign-simulator-${randomUUID()}.png`);

  try {
    await execFileAsync('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=png', screenshotPath], {
      timeout: 10_000
    });
    const screenshot = await readFile(screenshotPath);
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  } finally {
    await unlink(screenshotPath).catch(() => undefined);
  }
};

export const launchSimulatorVariant = async (udid: string, bundleId: unknown, variant: unknown) => {
  const simulators = await listAvailableSimulators();
  if (!simulators.some((simulator) => simulator.udid === udid)) {
    throw new Error('The selected simulator is no longer running.');
  }

  const validBundleId = assertBundleIdentifier(bundleId);
  const validVariant = assertSimulatorVariantId(variant);
  const { stdout } = await execFileAsync('xcrun', simulatorVariantLaunchArguments(udid, validBundleId, validVariant), {
    encoding: 'utf8',
    timeout: 20_000
  });

  return {
    bundleId: validBundleId,
    variant: validVariant,
    process: stdout.trim() || null
  };
};

export const launchSimulatorApp = async (udid: string, bundleId: unknown) => {
  const simulators = await listAvailableSimulators();
  if (!simulators.some((simulator) => simulator.udid === udid)) {
    throw new Error('The selected simulator is no longer running.');
  }

  const validBundleId = assertBundleIdentifier(bundleId);
  const { stdout } = await execFileAsync('xcrun', simulatorAppLaunchArguments(udid, validBundleId), {
    encoding: 'utf8',
    timeout: 20_000
  });

  return {
    bundleId: validBundleId,
    process: stdout.trim() || null
  };
};

export const ensureSimulatorAppInstalled = async (udid: string, bundleId: unknown) => {
  const validBundleId = assertBundleIdentifier(bundleId);
  try {
    await execFileAsync('xcrun', simulatorAppContainerArguments(udid, validBundleId), {
      encoding: 'utf8',
      timeout: 20_000
    });
  } catch {
    throw new Error(
      `The target app ${validBundleId} is not installed on the selected Simulator. Build and install its Debug app, then connect again.`
    );
  }
  return validBundleId;
};
