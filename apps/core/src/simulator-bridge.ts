import type { AddressInfo, Socket } from 'node:net';

import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { promisify } from 'node:util';

import { listAvailableSimulators, readSimulatorOrientation, type SimulatorOrientation } from './simulators';

interface SimMiddleware {
  (request: IncomingMessage, response: ServerResponse, next?: (error?: unknown) => Promise<void>): Promise<void>;
  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void;
}

type SimMiddlewareFactory = (options: {
  basePath: string;
  codec: string;
  device: string;
  execToken: string;
  proxyHelpers: boolean;
}) => SimMiddleware;

const execFileAsync = promisify(execFile);
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
// These literal paths let `bun build --compile` embed both the middleware and
// its N-API addon in the standalone Core executable.
const { simMiddleware } = require('../node_modules/serve-sim/dist/middleware.cjs') as {
  simMiddleware: SimMiddlewareFactory;
};
const native = require('../node_modules/serve-sim/dist/native/serve-sim-native.node') as {
  axDescribe(udid: string): Promise<string>;
};

export const waitForSimulatorBridgeHealth = async (
  url: string,
  options: {
    attempts?: number;
    fetcher?: typeof fetch;
    intervalMilliseconds?: number;
  } = {}
) => {
  const attempts = options.attempts ?? 30;
  const fetcher = options.fetcher ?? fetch;
  const intervalMilliseconds = options.intervalMilliseconds ?? 100;
  let lastError = 'Simulator stream did not become ready.';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const health = await fetcher(url, { signal: AbortSignal.timeout(1_000) });
      if (health.ok) return;
      lastError = (await health.text()) || `Simulator stream returned HTTP ${health.status}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt + 1 < attempts) await delay(intervalMilliseconds);
  }

  throw new Error(lastError);
};

export interface SimulatorConnection {
  udid: string;
  projectId: string;
  bundleIdentifier: string;
  streamUrl: string;
  wsUrl: string;
  orientation: SimulatorOrientation;
}

export interface AccessibilitySnapshot {
  screen: { width: number; height: number };
  elements: Array<{
    id: string;
    path: string;
    label: string;
    value: string;
    role: string;
    type: string;
    enabled: boolean;
    isContainer: boolean;
    frame: { x: number; y: number; width: number; height: number };
  }>;
  errors?: string[];
}

interface RawAccessibilityElement {
  AXUniqueId: string | null;
  AXLabel: string | null;
  AXValue: string | null;
  enabled: boolean;
  frame: { x: number; y: number; width: number; height: number };
  role_description: string;
  type: string;
  children: RawAccessibilityElement[];
}

const normalizeAccessibilityTree = (roots: RawAccessibilityElement[]): AccessibilitySnapshot => {
  const screenFrame = roots[0]?.frame ?? { x: 0, y: 0, width: 1, height: 1 };
  const elements: AccessibilitySnapshot['elements'] = [];
  const visit = (element: RawAccessibilityElement, path: string) => {
    if (elements.length >= 500) return;
    const { frame } = element;
    elements.push({
      id: element.AXUniqueId ?? path,
      path,
      label: element.AXLabel ?? '',
      value: element.AXValue ?? '',
      role: element.role_description,
      type: element.type,
      enabled: element.enabled !== false,
      isContainer: element.children.length > 0,
      frame: {
        x: frame.x - screenFrame.x,
        y: frame.y - screenFrame.y,
        width: frame.width,
        height: frame.height
      }
    });
    for (const [index, child] of element.children.entries()) {
      visit(child, `${path}.${index}`);
    }
  };
  for (const [index, root] of roots.entries()) visit(root, String(index));
  return {
    screen: { width: screenFrame.width, height: screenFrame.height },
    elements
  };
};

class SimulatorBridge {
  #connection: SimulatorConnection | null = null;
  #server: Server | null = null;

  get connection() {
    return this.#connection;
  }

  async connect(udid: string, target: { projectId: string; bundleIdentifier: string }): Promise<SimulatorConnection> {
    const simulators = await listAvailableSimulators();
    if (!simulators.some((simulator) => simulator.udid === udid && simulator.state === 'Booted')) {
      throw new Error('The selected simulator is no longer running.');
    }
    if (
      this.#connection?.udid === udid &&
      this.#connection.projectId === target.projectId &&
      this.#connection.bundleIdentifier === target.bundleIdentifier
    ) {
      return this.#connection;
    }

    await this.disconnect();
    const basePath = '/sim';
    const middleware = simMiddleware({
      basePath,
      codec: 'mjpeg',
      device: udid,
      execToken: randomBytes(32).toString('base64url'),
      proxyHelpers: true
    });
    const server = createServer((request, response) => {
      void middleware(request, response, async () => {
        response.statusCode = 404;
        response.end('Not found');
      }).catch((error: unknown) => {
        if (response.headersSent) {
          response.destroy(error instanceof Error ? error : undefined);
          return;
        }
        response.statusCode = 500;
        response.end(error instanceof Error ? error.message : 'Simulator bridge error');
      });
    });
    server.on('upgrade', (request, socket, head) => {
      middleware.handleUpgrade(request, socket as Socket, head);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.#server = server;
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;
    const helperPath = `${basePath}/helper/${udid}`;

    try {
      await waitForSimulatorBridgeHealth(`${origin}${helperPath}/health`);
    } catch (error) {
      await this.disconnect();
      throw new Error(
        `Could not start the bundled simulator stream: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.#connection = {
      udid,
      projectId: target.projectId,
      bundleIdentifier: target.bundleIdentifier,
      streamUrl: `${origin}${helperPath}/stream.mjpeg`,
      wsUrl: `ws://127.0.0.1:${address.port}${helperPath}/ws`,
      orientation: await readSimulatorOrientation(udid)
    };
    return this.#connection;
  }

  async disconnect() {
    this.#connection = null;
    const server = this.#server;
    this.#server = null;
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  async accessibilitySnapshot(): Promise<AccessibilitySnapshot> {
    const udid = this.#connection?.udid;
    if (!udid) throw new Error('Connect to a simulator first.');
    try {
      return normalizeAccessibilityTree(JSON.parse(await native.axDescribe(udid)) as RawAccessibilityElement[]);
    } catch (error) {
      throw new Error(
        `Could not read the simulator accessibility tree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async appearance(): Promise<'light' | 'dark'> {
    const udid = this.#connection?.udid;
    if (!udid) throw new Error('Connect to a simulator first.');
    const { stdout } = await execFileAsync('xcrun', ['simctl', 'ui', udid, 'appearance']);
    const appearance = stdout.trim();
    if (appearance !== 'light' && appearance !== 'dark') {
      throw new Error('This simulator does not support appearance switching.');
    }
    return appearance;
  }

  async setAppearance(appearance: 'light' | 'dark') {
    const udid = this.#connection?.udid;
    if (!udid) throw new Error('Connect to a simulator first.');
    await execFileAsync('xcrun', ['simctl', 'ui', udid, 'appearance', appearance]);
  }

  async setPasteboard(text: string) {
    const udid = this.#connection?.udid;
    if (!udid) throw new Error('Connect to a simulator first.');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('xcrun', ['simctl', 'pbcopy', udid], {
        stdio: ['pipe', 'ignore', 'pipe']
      });
      let errorOutput = '';
      child.stderr.on('data', (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errorOutput.trim() || `simctl pbcopy exited with code ${code}`));
      });
      child.stdin.end(text);
    });
  }
}

export const simulatorBridge = new SimulatorBridge();
