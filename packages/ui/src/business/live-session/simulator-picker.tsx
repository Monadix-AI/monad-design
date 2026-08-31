import type { ReactNode } from 'react';

import { RadioGroup } from 'radix-ui';

import { Button } from '../../primitives/button';
import { SimulatorDeviceGlyph } from './simulator-device-glyph';

export interface SimulatorPickerTarget {
  bundleIdentifier: string;
  name: string;
}

export interface SimulatorPickerDevice {
  connected: boolean;
  framebufferMask?: string;
  name: string;
  runtime: string;
  screen?: { width: number; height: number; scale: number };
  state: 'Booted' | 'Shutdown';
  udid: string;
}

export function LiveSessionSimulatorPicker({
  connectLabel,
  error,
  isConnecting,
  isScanning,
  onConnect,
  onSelectSimulator,
  onSelectTarget,
  project,
  selectedSimulatorUdid,
  selectedTargetBundleIdentifier,
  simulators,
  task,
  targetIcon,
  targets
}: {
  connectLabel?: ReactNode;
  error?: ReactNode;
  isConnecting: boolean;
  isScanning: boolean;
  onConnect: () => void;
  onSelectSimulator: (udid: string) => void;
  onSelectTarget: (bundleIdentifier: string) => void;
  project: { name: string; path?: string };
  selectedSimulatorUdid: string;
  selectedTargetBundleIdentifier: string;
  simulators: SimulatorPickerDevice[];
  task?: string;
  targetIcon?: (target: SimulatorPickerTarget) => ReactNode;
  targets: SimulatorPickerTarget[];
}) {
  const selectedSimulator = simulators.find(({ udid }) => udid === selectedSimulatorUdid);
  const selectedTarget = targets.find(({ bundleIdentifier }) => bundleIdentifier === selectedTargetBundleIdentifier);
  return (
    <div className="simulator-list-page">
      <section className="simulator-list-panel live-split">
        <div className="active-project-heading">
          <strong>{project.name}</strong>
          {project.path ? <code title={project.path}>{project.path}</code> : null}
          <code>
            {targets.length} {targets.length === 1 ? 'target app' : 'target apps'}
          </code>
        </div>
        <div
          aria-live="polite"
          className="agent-session-boundary"
          role="status"
        >
          <span className="agent-session-live">
            <span /> Agent waiting
          </span>
          <strong>Choose where to open this task</strong>
          {task ? <p>{task}</p> : null}
        </div>
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
              {targets.length} {targets.length === 1 ? 'app' : 'apps'}
            </span>
          </div>
          <RadioGroup.Root
            aria-label="Target app to launch"
            className="project-target-candidates target-app-list"
            onValueChange={onSelectTarget}
            value={selectedTargetBundleIdentifier}
          >
            {targets.map((target) => (
              <RadioGroup.Item
                className="project-target-candidate target-app-card"
                disabled={isConnecting}
                key={target.bundleIdentifier}
                value={target.bundleIdentifier}
              >
                <span
                  aria-hidden="true"
                  className="target-app-icon"
                >
                  {targetIcon?.(target) ?? target.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="project-target-candidate-copy">
                  <strong>{target.name}</strong>
                  <code>{target.bundleIdentifier}</code>
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
            onValueChange={onSelectSimulator}
            value={selectedSimulatorUdid}
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
            {!isScanning && simulators.length === 0 ? (
              <div className="empty-list">
                <div className="empty-device" />
                <strong>No available simulators</strong>
                <span>Install an iOS Simulator runtime in Xcode.</span>
              </div>
            ) : null}
          </RadioGroup.Root>
        </section>
        {error}
        <footer className="simulator-action-bar">
          <p aria-live="polite">
            {selectedTarget && selectedSimulator
              ? `${selectedTarget.name} · ${selectedSimulator.name}`
              : 'Choose a target app and Simulator to continue.'}
          </p>
          <Button
            className="connect-button"
            disabled={!selectedSimulatorUdid || !selectedTargetBundleIdentifier || isConnecting}
            onClick={onConnect}
            type="button"
          >
            {connectLabel ??
              (isConnecting
                ? selectedSimulator?.state === 'Shutdown'
                  ? 'Starting Simulator…'
                  : 'Connecting…'
                : selectedSimulator?.state === 'Shutdown'
                  ? 'Start & connect'
                  : 'Connect')}
          </Button>
        </footer>
      </section>
    </div>
  );
}
