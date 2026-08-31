import type { ProjectStore } from '../project-store';

import { randomBytes, randomInt } from 'node:crypto';
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
  accessToken: string;
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

export interface CoreServerOptions {
  host?: string;
  port?: number;
  pairingCode?: string;
  pairingStatePath?: string;
  localAccessToken?: string;
  addresses?: () => string[];
  agentSessions?: AgentSessionStore;
  ui?: (pathname: string) => Response | Promise<Response>;
}

const localAddresses = () => {
  const addresses = new Set<string>();
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === 'IPv4' && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses].sort();
};

export class CoreServer {
  readonly #configuredPort: number;
  readonly #pairingCode: string;
  readonly #localAccessToken: string;
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
    this.#localAccessToken = options.localAccessToken ?? randomBytes(32).toString('base64url');
    const agentSessions = options.agentSessions ?? new AgentSessionStore(projectStore);
    this.#mcp = createMonadDesignMcpHandler(projectStore, agentSessions, () => `${this.localClient.origin}/`);
    this.#app = createCoreApp(
      projectStore,
      [this.#pairingCode, this.#localAccessToken],
      this.#localAccessToken,
      this.#mcp,
      agentSessions,
      detectProjectTargets,
      options.ui
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
      origin: `http://127.0.0.1:${this.#boundPort ?? this.#configuredPort}`,
      accessToken: this.#localAccessToken
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
