import type { ProjectStore } from '../project-store';
import type { CoreErrorReporter } from './error-journal';

import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';

import { detectProjectTargets } from '../project-target-detection';
import { AgentSessionStore } from './agent-session-store';
import { type CoreApp, createCoreApp } from './core-app';
import { createMonadDesignMcpHandler } from './mcp-server';
import { resolvePairingCode } from './pairing-state';

export interface CoreServerStatus {
  port: number;
  pairingCode: string;
  addresses: string[];
}

export interface CoreLocalClient {
  origin: string;
}

interface NodeServerHandle {
  port?: number;
  raw?: {
    bun?: {
      server?: { port?: number };
    };
    node?: {
      server?: {
        address(): string | { port: number } | null;
      };
    };
  };
  stop(): void | Promise<void>;
}

const defaultPort = 41_765;

interface LocalAddress {
  address: string;
  interfaceName: string;
}

export interface CoreServerOptions {
  host?: string;
  port?: number;
  pairingCode?: string;
  pairingStatePath?: string;
  addresses?: () => string[];
  agentSessions?: AgentSessionStore;
  ui?: (pathname: string) => Response | Promise<Response>;
  reportError?: CoreErrorReporter;
}

const isPrivateAddress = (address: string) => {
  const [first = Number.NaN, second = Number.NaN] = address.split('.').map(Number);
  return (
    address.split('.').length === 4 &&
    (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168))
  );
};

export const prioritizeLocalAddresses = (addresses: readonly LocalAddress[], preferredInterface?: string) => {
  const preferredPhysicalInterface = preferredInterface?.match(/^en\d+$/u)?.[0];
  const unique = new Map<string, LocalAddress>();
  for (const entry of addresses) {
    const existing = unique.get(entry.address);
    if (!existing || entry.interfaceName === preferredPhysicalInterface) unique.set(entry.address, entry);
  }

  const priority = ({ address, interfaceName }: LocalAddress) => {
    if (address.startsWith('169.254.')) return 5;
    if (preferredPhysicalInterface && interfaceName === preferredPhysicalInterface) return 0;
    const physicalInterface = /^en\d+$/u.test(interfaceName);
    if (physicalInterface && isPrivateAddress(address)) return 1;
    if (physicalInterface) return 2;
    if (isPrivateAddress(address)) return 3;
    return 4;
  };

  return [...unique.values()]
    .sort((left, right) => priority(left) - priority(right) || left.address.localeCompare(right.address))
    .map(({ address }) => address);
};

const routeInterface = (interfaceName?: string) => {
  try {
    const route = execFileSync(
      '/sbin/route',
      ['-n', 'get', 'default', ...(interfaceName ? ['-ifscope', interfaceName] : [])],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return route.match(/^\s*interface:\s*(\S+)\s*$/mu)?.[1];
  } catch {
    return undefined;
  }
};

const preferredRouteInterface = (addresses: readonly LocalAddress[]) => {
  const systemDefault = routeInterface();
  if (systemDefault && /^en\d+$/u.test(systemDefault)) return systemDefault;

  const physicalInterfaces = [
    ...new Set(addresses.map(({ interfaceName }) => interfaceName).filter((name) => /^en\d+$/u.test(name)))
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return physicalInterfaces.find((interfaceName) => routeInterface(interfaceName) === interfaceName);
};

const localAddresses = () => {
  const addresses: LocalAddress[] = [];
  for (const [interfaceName, interfaces] of Object.entries(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === 'IPv4' && !item.internal) addresses.push({ address: item.address, interfaceName });
    }
  }
  return prioritizeLocalAddresses(addresses, preferredRouteInterface(addresses));
};

export class CoreServer {
  readonly #configuredPort: number;
  readonly #pairingCode: string;
  readonly #app: CoreApp;
  readonly #mcp: ReturnType<typeof createMonadDesignMcpHandler>;
  readonly #host: string;
  readonly #addresses: () => string[];
  #boundPort: number | null = null;
  #server: NodeServerHandle | null = null;

  constructor(
    projectStore: Pick<ProjectStore, 'list' | 'open' | 'add' | 'configureLiveTargets'> &
      Partial<Pick<ProjectStore, 'icons' | 'configure' | 'remove'>>,
    options: CoreServerOptions = {}
  ) {
    this.#host = options.host ?? '0.0.0.0';
    this.#configuredPort = options.port ?? defaultPort;
    this.#addresses = options.addresses ?? localAddresses;
    const addresses = this.#addresses();
    this.#pairingCode =
      options.pairingCode ??
      (options.pairingStatePath
        ? resolvePairingCode(options.pairingStatePath, addresses)
        : String(randomInt(100_000, 1_000_000)));
    const agentSessions = options.agentSessions ?? new AgentSessionStore(projectStore);
    this.#mcp = createMonadDesignMcpHandler(projectStore, agentSessions, () => `${this.localClient.origin}/`);
    this.#app = createCoreApp(
      projectStore,
      this.#pairingCode,
      this.#mcp,
      agentSessions,
      detectProjectTargets,
      options.ui,
      options.reportError
    );
  }

  get status(): CoreServerStatus {
    return {
      port: this.#boundPort ?? this.#configuredPort,
      pairingCode: this.#pairingCode,
      addresses: this.#addresses()
    };
  }

  get localClient(): CoreLocalClient {
    return {
      origin: `http://127.0.0.1:${this.#boundPort ?? this.#configuredPort}`
    };
  }

  async start() {
    if (this.#server) return;
    this.#app.listen(
      {
        hostname: this.#host,
        port: this.#configuredPort,
        // The compiled executable resolves srvx's Bun adapter, which forwards runtime options through this nested key.
        bun: { idleTimeout: 0 }
      } as Parameters<CoreApp['listen']>[0],
      (server) => {
        const handle = server as unknown as NodeServerHandle;
        this.#server = handle;
        const address = handle.raw?.node?.server?.address();
        this.#boundPort =
          typeof address === 'object' && address
            ? address.port
            : (handle.raw?.bun?.server?.port ?? handle.port ?? this.#configuredPort);
      }
    );
  }

  async stop() {
    this.#boundPort = null;
    const server = this.#server;
    this.#server = null;
    await this.#mcp.close();
    if (server) await server.stop();
  }
}
