import type { InstallScope, IntegrationStatus, SupportedAgent } from '@monaddesign/agent-integration';
import type { SetupState } from './setup-contract';

import { useClientTheme } from '@monaddesign/ui/business/live-session/theme';
import { Check, CircleAlert, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { AgentIcon } from './components/agent-icon';
import './setup.css';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
type Step = 'scope' | 'agents' | 'summary';
type InstallResult = {
  agent: string;
  success: boolean;
  error?: string;
  skillPath?: string | null;
  mcpPath?: string | null;
  instructions?: string;
};
const steps: Step[] = ['scope', 'agents', 'summary'];
const stepLabels = ['Installation', 'Coding agents', 'Summary'];

export function AgentSetup({
  onClose,
  notice,
  active = true
}: {
  onClose: () => Promise<void>;
  notice?: string | null;
  active?: boolean;
}) {
  const [step, setStep] = useState<Step>('scope');
  const [scope, setScope] = useState<InstallScope>('global');
  const [project, setProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<IntegrationStatus[]>([]);
  const [selected, setSelected] = useState<SupportedAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState('');
  const [scanFailed, setScanFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<InstallResult[]>([]);
  const [pluginPath, setPluginPath] = useState<string | null>(null);
  const [replaceModified, setReplaceModified] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const scanGeneration = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Move keyboard focus when the visible step changes.
  useEffect(() => {
    if (active) heading.current?.focus();
  }, [step, active]);
  useEffect(
    () => () => {
      scanGeneration.current += 1;
    },
    []
  );
  const refresh = async () => {
    const generation = ++scanGeneration.current;
    setScanning(true);
    setError('');
    setScanFailed(false);
    try {
      const next = await window.client.setup.scan(scope);
      if (generation === scanGeneration.current) {
        setAgents(next);
        setSelected((current) =>
          current.filter((id) => next.some((item) => item.agent === id && item.supported && !item.error))
        );
      }
    } catch (error) {
      if (generation === scanGeneration.current) {
        setError(message(error));
        setScanFailed(true);
      }
    } finally {
      if (generation === scanGeneration.current) setScanning(false);
    }
  };
  const perform = async (action: () => Promise<void>, label = 'Working…') => {
    setOperation(label);
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
      setOperation('');
    }
  };
  const available = agents.filter((agent) => agent.supported);
  const visible = available.filter(
    (agent) =>
      (showAll || agent.detected || selected.includes(agent.agent)) &&
      agent.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const modified = agents.filter((agent) => selected.includes(agent.agent) && agent.skill === 'modified');
  const failed = results.filter((result) => !result.success);
  const install = async (ids: SupportedAgent[]) => {
    const result = await window.client.setup.install({ agents: ids, scope, replaceModified });
    setResults((current) => [...current.filter((item) => !ids.includes(item.agent as SupportedAgent)), ...result]);
    setStep('summary');
  };
  const changeScope = (next: InstallScope) => {
    setScope(next);
    setAgents([]);
    setQuery('');
    setSelected([]);
    setReplaceModified(false);
    setError('');
  };
  const title =
    step === 'scope'
      ? 'Where would you like to install?'
      : step === 'agents'
        ? 'Connect your coding agents'
        : pluginPath
          ? 'Your plugin is ready to import'
          : failed.length
            ? 'Some agents need attention'
            : 'You’re ready to create';
  return (
    <main className="setup-screen">
      <section
        aria-labelledby="setup-title"
        className="setup-panel"
      >
        <header className="setup-topbar">
          <span className="setup-eyebrow">MONAD DESIGN</span>
          <button
            className="setup-text-button"
            disabled={busy || scanning}
            onClick={() => void perform(onClose, 'Opening Monad Design…')}
            type="button"
          >
            {step === 'summary' ? 'Close setup' : 'Set up later'}
          </button>
        </header>
        <ol
          aria-label="Setup progress"
          className="setup-steps"
        >
          {steps.map((item, index) => (
            <li
              aria-current={item === step ? 'step' : undefined}
              data-complete={steps.indexOf(step) > index}
              key={item}
            >
              <span>
                {steps.indexOf(step) > index ? (
                  <Check
                    aria-hidden="true"
                    size={13}
                  />
                ) : (
                  index + 1
                )}
              </span>
              {stepLabels[index]}
            </li>
          ))}
        </ol>
        <div className="setup-heading">
          <h1
            id="setup-title"
            ref={heading}
            tabIndex={-1}
          >
            {title}
          </h1>
          <p>
            {step === 'scope'
              ? 'Choose where your agents can use Monad Design.'
              : step === 'agents'
                ? 'Choose the agents you use. We’ll add the Monad Design skill and MCP connection.'
                : pluginPath
                  ? 'Import this folder in Kimi Work, then enable the plugin to get started.'
                  : failed.length
                    ? 'Successful installations are saved. You can retry the remaining agents below.'
                    : 'Start a new session in your coding agent to load Monad Design.'}
          </p>
        </div>
        {step === 'scope' && (
          <>
            <fieldset className="setup-scopes">
              <legend className="setup-sr-only">Installation scope</legend>
              {(['global', 'project'] as const).map((value) => (
                <label
                  className="setup-scope"
                  key={value}
                >
                  <input
                    checked={scope === value}
                    disabled={busy}
                    name="installation-scope"
                    onChange={() => changeScope(value)}
                    type="radio"
                    value={value}
                  />
                  <span>
                    <strong>{value === 'global' ? 'Global' : 'Specific project'}</strong>
                    <small>
                      {value === 'global'
                        ? 'Available across projects for this Mac user.'
                        : 'Available only in a project you choose.'}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            {scope === 'project' && (
              <div className="setup-project">
                <div>
                  <strong>{project ? project.split('/').pop() : 'Choose your project'}</strong>
                  <p>{project ? project : 'Select the root folder of your Git repository.'}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const path = await window.client.setup.chooseProject();
                      if (path) {
                        setProject(path);
                        setAgents([]);
                        setSelected([]);
                        setReplaceModified(false);
                      }
                    })
                  }
                  type="button"
                >
                  {busy ? 'Choosing…' : project ? 'Change folder…' : 'Choose folder…'}
                </button>
              </div>
            )}
          </>
        )}
        {step === 'agents' && (
          <>
            <div className="setup-list-heading">
              <span>{scope === 'global' ? 'Global installation' : `Project · ${project?.split('/').pop()}`}</span>
              <button
                className="setup-text-button"
                disabled={busy || scanning}
                onClick={() => void refresh()}
                type="button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={scanning ? 'setup-spin' : undefined}
                  size={14}
                />
                {scanning ? 'Scanning…' : 'Scan again'}
              </button>
            </div>
            <label className="setup-search">
              <Search
                aria-hidden="true"
                size={16}
              />
              <input
                aria-label="Search coding agents"
                disabled={busy || scanning}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value) setShowAll(true);
                }}
                placeholder="Search agents…"
                type="search"
                value={query}
              />
            </label>
            <fieldset
              aria-busy={scanning}
              aria-label="Coding agents"
              className="setup-agents"
            >
              {scanning && agents.length === 0 ? (
                <p
                  className="setup-empty"
                  role="status"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="setup-spin"
                    size={20}
                  />
                  Finding your coding agents…
                </p>
              ) : visible.length === 0 ? (
                <p className="setup-empty">
                  {error
                    ? 'Agent detection could not finish. Try scanning again.'
                    : query.trim()
                      ? 'No matching agents. Try another name.'
                      : showAll
                        ? 'No agents available for this installation.'
                        : 'No agents detected. Browse all agents to choose one.'}
                </p>
              ) : (
                visible.map((agent) => (
                  <label
                    className="setup-agent"
                    key={agent.agent}
                  >
                    <input
                      checked={selected.includes(agent.agent)}
                      disabled={busy || scanning || scanFailed || Boolean(agent.error)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked ? [...current, agent.agent] : current.filter((id) => id !== agent.agent)
                        )
                      }
                      type="checkbox"
                    />
                    <AgentIcon agent={agent.agent} />
                    <span className="setup-agent-copy">
                      <strong>{agent.name}</strong>
                      <small
                        className={
                          agent.error
                            ? 'setup-error'
                            : agent.skill === 'current' && agent.mcp === 'configured'
                              ? 'setup-success'
                              : undefined
                        }
                      >
                        {agent.error
                          ? 'Needs attention'
                          : agent.skill === 'modified'
                            ? 'Skill has local changes'
                            : agent.mcp === 'conflict'
                              ? 'MCP configuration conflict'
                              : agent.skill === 'current' && agent.mcp === 'configured'
                                ? 'Connected'
                                : agent.skill === 'outdated' || agent.mcp === 'stale'
                                  ? 'Update available'
                                  : agent.detected
                                    ? 'Detected · Not connected'
                                    : 'Not detected'}
                      </small>
                      {agent.error && <small className="setup-error">{agent.error}</small>}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
            <div className="setup-list-heading">
              <span aria-live="polite">
                {scanning
                  ? 'Checking installed agents and connections…'
                  : `${available.filter((agent) => agent.detected).length} detected · ${selected.length} selected`}
              </span>
              <button
                aria-pressed={showAll}
                className="setup-text-button"
                disabled={busy || scanning}
                onClick={() => setShowAll(!showAll)}
                type="button"
              >
                {showAll ? 'Show detected agents' : 'Browse all agents'}
              </button>
            </div>
            {modified.length > 0 && (
              <label className="setup-replace">
                <input
                  checked={replaceModified}
                  disabled={busy}
                  onChange={(event) => setReplaceModified(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Replace existing skills for {modified.map((agent) => agent.name).join(', ')}, including local changes.
                </span>
              </label>
            )}
            {showAll && (
              <p className="setup-hint">
                This connects Monad Design to your agents. It does not install the agent applications.
              </p>
            )}
            {scope === 'global' && (
              <p className="setup-hint">
                Agents that require a project are available with Specific project installation.
              </p>
            )}
            <button
              className="setup-text-button setup-kimi"
              disabled={busy || scanning}
              onClick={() =>
                void perform(async () => {
                  setPluginPath(await window.client.setup.exportKimiWork());
                  setResults([]);
                  setStep('summary');
                }, 'Preparing Kimi Work plugin…')
              }
              type="button"
            >
              Using Kimi Work? Prepare a plugin to import
            </button>
          </>
        )}
        {step === 'summary' && (
          <div className="setup-summary">
            <div className="setup-summary-scope">
              <strong>
                {pluginPath ? 'Kimi Work plugin' : scope === 'global' ? 'Global installation' : 'Project installation'}
              </strong>
              {!pluginPath && scope === 'project' && <p className="setup-path">{project}</p>}
            </div>
            {results.map((result) => (
              <article
                className="setup-result"
                key={result.agent}
              >
                <div className="setup-result-heading">
                  <AgentIcon agent={result.agent as SupportedAgent} />
                  <strong>{agents.find((agent) => agent.agent === result.agent)?.name ?? result.agent}</strong>
                  <span className={result.success ? 'setup-success' : 'setup-error'}>
                    {result.success ? 'Installed' : 'Needs attention'}
                  </span>
                </div>
                {result.success && (
                  <dl className="setup-paths">
                    {result.skillPath && (
                      <>
                        <dt>Skill</dt>
                        <dd>{result.skillPath}</dd>
                      </>
                    )}
                    {result.mcpPath && (
                      <>
                        <dt>MCP</dt>
                        <dd>{result.mcpPath}</dd>
                      </>
                    )}
                  </dl>
                )}
                {result.instructions && <p className="setup-hint">{result.instructions}</p>}
                {result.error && <p className="setup-error">{result.error}</p>}
              </article>
            ))}
            {pluginPath && (
              <div className="setup-result">
                <strong>Kimi Work</strong>
                <p className="setup-path">{pluginPath}</p>
                <p className="setup-hint">Prepared only. Import and activation in Kimi Work are still required.</p>
              </div>
            )}
          </div>
        )}
        {busy && (
          <p
            className="setup-operation"
            role="status"
          >
            <LoaderCircle
              aria-hidden="true"
              className="setup-spin"
              size={16}
            />
            {operation}
          </p>
        )}
        {error && (
          <p
            className="setup-error setup-alert"
            role="alert"
          >
            {error}
          </p>
        )}
        <footer className="setup-footer">
          <div className="setup-runtime">
            <span className="setup-status-dot" />
            Core is running
            {notice && <p>{notice}</p>}
          </div>
          <div className="setup-actions">
            {step !== 'scope' && (
              <button
                disabled={busy || scanning}
                onClick={() => {
                  setError('');
                  if (step === 'summary') {
                    setStep('agents');
                    setResults([]);
                    setPluginPath(null);
                    void refresh();
                  } else {
                    setStep('scope');
                  }
                }}
                type="button"
              >
                Back
              </button>
            )}
            {step === 'scope' && (
              <button
                className="setup-primary"
                disabled={busy || (scope === 'project' && !project)}
                onClick={() => {
                  setStep('agents');
                  void refresh();
                }}
                type="button"
              >
                Continue
              </button>
            )}
            {step === 'agents' && (
              <button
                className="setup-primary"
                disabled={
                  busy || scanning || scanFailed || selected.length === 0 || (modified.length > 0 && !replaceModified)
                }
                onClick={() =>
                  void perform(
                    () => install(selected),
                    `Connecting ${selected.length} ${selected.length === 1 ? 'agent' : 'agents'}…`
                  )
                }
                type="button"
              >
                {busy
                  ? 'Working…'
                  : selected.length
                    ? `Connect ${selected.length}${selected.length === 1 ? ' agent' : ' agents'}`
                    : 'Select agents to continue'}
              </button>
            )}
            {step === 'summary' && (
              <>
                {failed.length > 0 && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        () => install(failed.map((item) => item.agent as SupportedAgent)),
                        'Retrying failed connections…'
                      )
                    }
                    type="button"
                  >
                    {busy ? 'Retrying…' : 'Retry failed'}
                  </button>
                )}
                <button
                  className="setup-primary"
                  disabled={busy}
                  onClick={() => void perform(onClose, 'Opening Monad Design…')}
                  type="button"
                >
                  Open Monad Design
                </button>
              </>
            )}
          </div>
        </footer>
        <details className="setup-runtime-details">
          <summary>Core details</summary>
          <p>Core runs locally on this Mac and connects your agents to Monad Design.</p>
          <button
            disabled={busy || scanning}
            onClick={() =>
              void perform(async () => {
                setRuntimeMessage('');
                const state = await window.client.setup.retry();
                if (state.phase === 'error') throw new Error(state.error);
                setRuntimeMessage(state.notice ?? 'Core is ready.');
              }, 'Checking Core…')
            }
            type="button"
          >
            Check Core again
          </button>
          {runtimeMessage && <p role="status">{runtimeMessage}</p>}
        </details>
      </section>
    </main>
  );
}

function SetupAppearance() {
  useClientTheme();
  return null;
}

export function SetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SetupState>({ phase: 'preparing', completed: false });
  const retrying = useRef(false);
  const coreHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.phase !== 'ready') coreHeading.current?.focus();
  }, [state.phase]);
  const [open, setOpen] = useState(false);
  const [wasReady, setWasReady] = useState(false);
  useEffect(() => {
    if (state.phase === 'ready') setWasReady(true);
  }, [state.phase]);
  useEffect(() => {
    let active = true;
    let timer: number;
    const refresh = async () => {
      if (!active) return;
      try {
        const next = await window.client.setup.status();
        if (active && !retrying.current) setState(next);
      } catch (error) {
        if (active && !retrying.current) setState((current) => ({ ...current, phase: 'error', error: message(error) }));
      }
      if (active) timer = window.setTimeout(() => void refresh(), 1000);
    };
    void refresh();
    const show = () => setOpen(true);
    window.addEventListener('monad-design:setup', show);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('monad-design:setup', show);
    };
  }, []);
  const blocker =
    state.phase !== 'ready' ? (
      <main className="setup-screen">
        <section
          aria-labelledby="core-title"
          className="setup-panel setup-core-panel"
        >
          <span className="setup-eyebrow">MONAD DESIGN · LOCAL CORE</span>
          <div
            aria-hidden="true"
            className={`setup-core-symbol ${state.phase === 'error' ? 'setup-error' : ''}`}
          >
            {state.phase === 'error' ? (
              <CircleAlert size={28} />
            ) : (
              <LoaderCircle
                className="setup-spin"
                size={28}
              />
            )}
          </div>
          <div className="setup-heading">
            <h1
              id="core-title"
              ref={coreHeading}
              tabIndex={-1}
            >
              {state.phase === 'error' ? 'Core needs attention' : 'Getting Core ready'}
            </h1>
            <p>
              {state.phase === 'error'
                ? 'We couldn’t start the local runtime. Retry to check the installation and start Core again.'
                : 'Checking the local installation and starting Core. Setup will continue automatically when it’s ready.'}
            </p>
          </div>
          <p role={state.phase === 'error' ? 'alert' : 'status'}>
            {state.phase === 'error' ? state.error : 'Preparing your local runtime…'}
          </p>
          {state.phase === 'error' && (
            <button
              className="setup-primary"
              onClick={() => {
                if (retrying.current) return;
                retrying.current = true;
                setState({ ...state, phase: 'preparing', error: undefined });
                void window.client.setup
                  .retry()
                  .then(setState)
                  .catch((error) => setState({ ...state, phase: 'error', error: message(error) }))
                  .finally(() => {
                    retrying.current = false;
                  });
              }}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                size={16}
              />{' '}
              Retry Core
            </button>
          )}
        </section>
      </main>
    ) : null;
  const showSetup = open || !state.completed;
  return (
    <>
      {!wasReady && <SetupAppearance />}
      <div hidden={showSetup || Boolean(blocker)}>{wasReady ? children : null}</div>
      {blocker}
      {wasReady && showSetup && (
        <div hidden={Boolean(blocker)}>
          <AgentSetup
            active={!blocker}
            notice={state.notice}
            onClose={async () => {
              await window.client.setup.complete();
              setState((current) => ({ ...current, completed: true }));
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}
