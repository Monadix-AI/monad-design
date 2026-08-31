import type {
  MonadDesignProject,
  ProjectDirectorySelection,
  ProjectTargetDetection,
  ProjectTargetSource
} from '@/electron';

import AppStoreIcon from '@hugeicons/core-free-icons/AppStoreIcon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ConnectIcon from '@hugeicons/core-free-icons/ConnectIcon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import FolderOpenIcon from '@hugeicons/core-free-icons/FolderOpenIcon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import RefreshCwIcon from '@hugeicons/core-free-icons/RefreshCwIcon';
import { HugeiconsIcon } from '@hugeicons/react';
import { Navigate } from '@tanstack/react-router';
import { Dialog, RadioGroup } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { ActionIcon } from '@/components/action-icon';
import { AppHeader } from '@/components/app-header';
import { SimulatorDeviceGlyph } from '@/components/simulator-device-glyph';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDesktopApp } from '@/desktop-app-provider';

type TargetSetup = ({ kind: 'new' } & ProjectDirectorySelection) | { kind: 'existing'; project: MonadDesignProject };

type TargetDetectionState =
  | { status: 'idle' | 'detecting' }
  | { status: 'complete'; result: ProjectTargetDetection }
  | { status: 'error'; message: string };

const targetSetupPath = (setup: TargetSetup) => (setup.kind === 'new' ? setup.path : setup.project.path);

const targetSourceLabels: Record<ProjectTargetSource, string> = {
  'project-config': 'Existing config',
  expo: 'Expo',
  xcode: 'Xcode'
};

export function SimulatorsRoute() {
  const {
    activeAgentSession,
    activeProject,
    activateProject,
    addProject,
    chooseProject,
    closeProject,
    connect,
    connection,
    configureProject,
    detectProjectTargets,
    error,
    isConnecting,
    isLoadingProjects,
    isOpeningProject,
    isScanning,
    projects,
    projectIcons,
    removeProject,
    removingProjectId,
    selectedTargetBundleIdentifier,
    selectedUdid,
    setSelectedTargetBundleIdentifier,
    setSelectedUdid,
    simulators
  } = useDesktopApp();
  const [targetSetup, setTargetSetup] = useState<TargetSetup | null>(null);
  const [manualBundleIdentifier, setManualBundleIdentifier] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [targetAppIcons, setTargetAppIcons] = useState<Record<string, string>>({});
  const [detection, setDetection] = useState<TargetDetectionState>({
    status: 'idle'
  });
  const detectionRequest = useRef(0);
  const detectTargetApps = async (setup: TargetSetup) => {
    const request = ++detectionRequest.current;
    setDetection({ status: 'detecting' });
    setSetupError(null);
    try {
      const result = await detectProjectTargets(targetSetupPath(setup));
      if (request !== detectionRequest.current) return;
      setDetection({ status: 'complete', result });
      setManualBundleIdentifier('');
    } catch (reason) {
      if (request !== detectionRequest.current) return;
      setDetection({
        status: 'error',
        message: reason instanceof Error ? reason.message : 'Could not inspect this project.'
      });
    }
  };
  const openTargetSetup = (setup: TargetSetup) => {
    setTargetSetup(setup);
    setManualBundleIdentifier('');
    void detectTargetApps(setup);
  };
  const beginAddProject = async () => {
    const selection = await chooseProject();
    if (!selection) return;
    openTargetSetup({ kind: 'new', ...selection });
  };
  const saveTargetApps = async () => {
    if (!targetSetup) return;
    setSetupError(null);
    try {
      const targets =
        detectedCandidates.length > 0
          ? detectedCandidates.map(({ bundleIdentifier, name, sourcePath }) => ({
              bundleIdentifier,
              name,
              sourcePath
            }))
          : [
              {
                bundleIdentifier: manualBundleIdentifier.trim(),
                name: manualBundleIdentifier.trim()
              }
            ];
      if (targetSetup.kind === 'new') {
        await addProject(targetSetup.path, targets);
      } else {
        await configureProject(targetSetup.project.id, targets);
      }
      setTargetSetup(null);
    } catch (reason) {
      setSetupError(reason instanceof Error ? reason.message : 'Could not save target apps.');
    }
  };
  const selectedSimulator = simulators.find(({ udid }) => udid === selectedUdid);
  const selectedTargetApp = activeProject?.targetApps.find(
    ({ bundleIdentifier }) => bundleIdentifier === selectedTargetBundleIdentifier
  );
  const detectedCandidates = detection.status === 'complete' ? detection.result.candidates : [];
  const manualTargetEntry =
    detection.status === 'error' || (detection.status === 'complete' && detectedCandidates.length === 0);

  useEffect(() => {
    if (!activeProject) {
      setTargetAppIcons({});
      return;
    }
    let current = true;
    setTargetAppIcons({});
    void projectIcons(activeProject.id)
      .then((icons) => {
        if (current) setTargetAppIcons(icons);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [activeProject, projectIcons]);

  if (connection)
    return (
      <Navigate
        replace
        to="/workspace"
      />
    );

  if (!activeProject) {
    return (
      <main className="app-shell">
        <AppHeader />
        <section className="project-home">
          <div className="project-home-heading">
            <div>
              <h1>Projects</h1>
              <p>Open a local iOS project to inspect its runtime in Simulator.</p>
            </div>
            <Button
              className="add-project-button"
              onClick={() => void beginAddProject()}
              type="button"
            >
              <ActionIcon
                icon={PlusSignIcon}
                spinning={isOpeningProject}
              />
              Connect project
            </Button>
          </div>

          <div
            aria-live="polite"
            className="project-registry"
          >
            {isLoadingProjects && (
              <div
                className="project-loading"
                role="status"
              >
                <ActionIcon
                  icon={RefreshCwIcon}
                  spinning
                />
                Loading local projects…
              </div>
            )}
            {projects.map((project) => (
              <div
                className="project-row"
                key={project.id}
              >
                <button
                  className="project-row-open"
                  disabled={isOpeningProject || removingProjectId !== null}
                  onClick={() => void activateProject(project)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="project-folder"
                  >
                    <ActionIcon icon={FolderOpenIcon} />
                  </span>
                  <span className="project-identity">
                    <strong>{project.name}</strong>
                    <code>
                      {project.targetApps.length === 1
                        ? project.targetApps[0]?.bundleIdentifier
                        : `${project.targetApps.length} target apps`}
                    </code>
                  </span>
                  <span
                    aria-hidden="true"
                    className="project-row-chevron"
                  >
                    ›
                  </span>
                </button>
                <button
                  aria-label={`Remove ${project.name} from projects`}
                  className="project-row-remove"
                  disabled={isOpeningProject || removingProjectId !== null}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove “${project.name}” from Monad Design?\n\nThe project and its .monaddesign configuration will remain on disk.`
                      )
                    ) {
                      void removeProject(project);
                    }
                  }}
                  title="Remove from projects"
                  type="button"
                >
                  <ActionIcon
                    icon={Delete02Icon}
                    spinning={removingProjectId === project.id}
                  />
                </button>
              </div>
            ))}

            {!isLoadingProjects && projects.length === 0 && (
              <div className="project-empty">
                <span className="empty-project-mark">
                  <ActionIcon icon={FolderOpenIcon} />
                </span>
                <h2>Bring in your first project</h2>
                <p>
                  Monad Design adds a small <code>.monaddesign/project.json</code>
                  configuration inside the selected directory. No source is changed.
                </p>
                <Button
                  className="add-project-button"
                  disabled={isOpeningProject}
                  onClick={() => void beginAddProject()}
                  type="button"
                >
                  <ActionIcon icon={PlusSignIcon} />
                  Choose directory
                </Button>
              </div>
            )}
          </div>
          {error && (
            <p
              className="error-message project-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <footer className="project-boundary">
            <span>Local project registry</span>
            <span>Configuration written only after you choose a directory</span>
          </footer>
          <Dialog.Root
            onOpenChange={(open) => {
              if (open) return;
              detectionRequest.current += 1;
              setTargetSetup(null);
              setDetection({ status: 'idle' });
            }}
            open={targetSetup !== null}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="project-target-overlay" />
              <Dialog.Content className="project-target-dialog">
                <Dialog.Title>Confirm iOS target apps</Dialog.Title>
                <Dialog.Description>
                  Monad Design verifies the Git root, then saves every detected app that can be launched from this
                  project.
                </Dialog.Description>
                <div className="project-target-path">
                  <strong>{targetSetup?.kind === 'new' ? targetSetup.name : targetSetup?.project.name}</strong>
                  <code>{targetSetup?.kind === 'new' ? targetSetup.path : targetSetup?.project.path}</code>
                </div>
                <div
                  aria-live="polite"
                  className="project-target-detection"
                >
                  {detection.status === 'detecting' && (
                    <div
                      className="project-target-detecting"
                      role="status"
                    >
                      <ActionIcon
                        icon={RefreshCwIcon}
                        spinning
                      />
                      <span>
                        <strong>Detecting target apps…</strong>
                        Inspecting Expo configuration and Xcode project settings.
                      </span>
                    </div>
                  )}
                  {detection.status === 'complete' && detectedCandidates.length > 0 && (
                    <>
                      <p className="project-target-result">
                        <strong>
                          {detectedCandidates.length === 1
                            ? 'Target app detected'
                            : `${detectedCandidates.length} target apps detected`}
                        </strong>
                        <span>
                          {detectedCandidates.length === 1
                            ? 'Confirm the detected app before binding.'
                            : 'All detected apps will be added to this project.'}
                        </span>
                      </p>
                      <ul
                        aria-label="Detected target apps to add"
                        className="project-target-candidates"
                      >
                        {detectedCandidates.map((candidate) => (
                          <li
                            className="project-target-candidate"
                            data-state="checked"
                            key={candidate.bundleIdentifier}
                          >
                            <span
                              aria-hidden="true"
                              className="project-target-radio"
                            />
                            <span className="project-target-candidate-copy">
                              <span>
                                <strong>{candidate.name}</strong>
                                <small>{targetSourceLabels[candidate.source]}</small>
                              </span>
                              <code>{candidate.bundleIdentifier}</code>
                              <small>{candidate.sourcePath}</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {detection.status === 'complete' && detectedCandidates.length === 0 && (
                    <p className="project-target-result empty">
                      <strong>No explicit iOS target found</strong>
                      <span>Specify the installed app manually.</span>
                    </p>
                  )}
                  {detection.status === 'error' && (
                    <div className="project-target-detection-error">
                      <strong>Automatic detection did not complete.</strong>
                      <span>{detection.message}</span>
                      <Button
                        className="secondary-action project-target-retry"
                        onClick={() => targetSetup && void detectTargetApps(targetSetup)}
                        type="button"
                      >
                        Retry detection
                      </Button>
                    </div>
                  )}
                </div>
                {manualTargetEntry && (
                  <Label htmlFor="project-target-bundle-id">
                    <span>Target bundle identifier</span>
                    <Input
                      aria-describedby="project-target-help"
                      aria-invalid={setupError ? true : undefined}
                      autoFocus
                      id="project-target-bundle-id"
                      maxLength={255}
                      onChange={(event) => {
                        setManualBundleIdentifier(event.target.value);
                        setSetupError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && manualBundleIdentifier.trim() && !isOpeningProject) {
                          event.preventDefault();
                          void saveTargetApps();
                        }
                      }}
                      placeholder="com.example.app"
                      required
                      value={manualBundleIdentifier}
                    />
                  </Label>
                )}
                <p
                  className="project-target-help"
                  id="project-target-help"
                >
                  The detected targets are written to <code>.monaddesign/project.json</code>.
                </p>
                {detection.status === 'complete' && detection.result.warnings.length > 0 && (
                  <p className="project-target-warning">{detection.result.warnings.join(' ')}</p>
                )}
                {setupError && (
                  <p
                    className="error-message"
                    role="alert"
                  >
                    {setupError}
                  </p>
                )}
                <div className="project-target-actions">
                  <Dialog.Close asChild>
                    <Button
                      className="secondary-action"
                      type="button"
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    disabled={
                      detection.status === 'detecting' ||
                      (detectedCandidates.length === 0 && !manualBundleIdentifier.trim()) ||
                      isOpeningProject
                    }
                    onClick={() => void saveTargetApps()}
                    type="button"
                  >
                    {isOpeningProject ? 'Saving…' : 'Connect project'}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="simulator-list-page">
        <section className="simulator-list-panel live-split">
          <button
            className="page-back"
            onClick={closeProject}
            type="button"
          >
            <ActionIcon icon={ArrowLeft01Icon} />
            All projects
          </button>
          <div className="active-project-heading">
            <strong>{activeProject.name}</strong>
            <code title={activeProject.path}>{activeProject.path}</code>
            <code>
              {activeProject.targetApps.length} {activeProject.targetApps.length === 1 ? 'target app' : 'target apps'}
            </code>
          </div>
          {activeAgentSession?.status === 'selecting_simulator' && (
            <div
              aria-live="polite"
              className="agent-session-boundary"
              role="status"
            >
              <span className="agent-session-live">
                <span /> Agent waiting
              </span>
              <strong>Choose where to open this task</strong>
              {activeAgentSession.task && <p>{activeAgentSession.task}</p>}
            </div>
          )}
          <section
            aria-labelledby="target-app-heading-v2"
            className="picker-section target-app-section"
          >
            <div className="picker-section-heading">
              <div>
                <h2 id="target-app-heading-v2">Target app</h2>
                <p>Configured locally for this project.</p>
              </div>
              <span className="picker-count">
                {activeProject.targetApps.length} {activeProject.targetApps.length === 1 ? 'app' : 'apps'}
              </span>
            </div>
            <RadioGroup.Root
              aria-label="Target app to launch"
              className="project-target-candidates target-app-list"
              onValueChange={setSelectedTargetBundleIdentifier}
              value={selectedTargetBundleIdentifier}
            >
              {activeProject.targetApps.map((app) => (
                <RadioGroup.Item
                  className="project-target-candidate target-app-card"
                  disabled={isConnecting}
                  key={app.bundleIdentifier}
                  value={app.bundleIdentifier}
                >
                  <span
                    aria-hidden="true"
                    className="target-app-icon"
                  >
                    {targetAppIcons[app.bundleIdentifier] ? (
                      <img
                        alt=""
                        src={targetAppIcons[app.bundleIdentifier]}
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={AppStoreIcon}
                        size={21}
                        strokeWidth={1.6}
                      />
                    )}
                  </span>
                  <span className="project-target-candidate-copy">
                    <strong>{app.name}</strong>
                    <code>{app.bundleIdentifier}</code>
                  </span>
                  <span className="project-target-radio" />
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </section>
          <section
            aria-labelledby="simulator-heading-v2"
            className="picker-section simulator-section"
          >
            <div className="picker-section-heading">
              <div>
                <h2 id="simulator-heading-v2">Simulator</h2>
                <p>Booted devices connect immediately; shut down devices start first.</p>
              </div>
              <span className="picker-count">
                {simulators.length} {simulators.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
            <RadioGroup.Root
              aria-label="Available simulators"
              aria-live="polite"
              className="device-list"
              onValueChange={setSelectedUdid}
              value={selectedUdid}
            >
              {simulators.map((simulator) => (
                <RadioGroup.Item
                  className="device-card"
                  disabled={isConnecting}
                  key={simulator.udid}
                  value={simulator.udid}
                >
                  <span
                    aria-hidden="true"
                    className="device-selection-indicator"
                  />
                  <SimulatorDeviceGlyph simulator={simulator} />
                  <span className="device-details">
                    <strong>{simulator.name}</strong>
                    <small>{simulator.runtime}</small>
                  </span>
                  <span
                    className={`device-status ${simulator.connected ? 'connected' : simulator.state === 'Booted' ? 'booted' : 'shutdown'}`}
                  >
                    <span className="status-dot" />
                    {simulator.connected ? 'Connected' : simulator.state}
                  </span>
                </RadioGroup.Item>
              ))}
              {!isScanning && simulators.length === 0 && (
                <div className="empty-list">
                  <div className="empty-device" />
                  <strong>No available simulators</strong>
                  <span>Install an iOS Simulator runtime in Xcode.</span>
                </div>
              )}
            </RadioGroup.Root>
          </section>
          {error && (
            <p
              className="error-message"
              role="alert"
            >
              {error}
            </p>
          )}
          <footer className="simulator-action-bar">
            <p aria-live="polite">
              {selectedTargetApp && selectedSimulator
                ? `${selectedTargetApp.name} · ${selectedSimulator.name}`
                : 'Choose a target app and Simulator to continue.'}
            </p>
            <Button
              className="connect-button"
              disabled={!selectedUdid || !selectedTargetBundleIdentifier || isConnecting}
              onClick={() => void connect()}
              type="button"
            >
              <ActionIcon
                icon={ConnectIcon}
                spinning={isConnecting}
              />
              {isConnecting
                ? selectedSimulator?.state === 'Shutdown'
                  ? 'Starting Simulator…'
                  : 'Connecting…'
                : selectedSimulator?.state === 'Shutdown'
                  ? 'Start & connect'
                  : 'Connect'}
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}
