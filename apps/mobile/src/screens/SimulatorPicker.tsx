import type { IOSSimulator, RemoteProject, SimulatorConnectionResponse } from '@monaddesign/client-contract';

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  simulatorSelectors,
  useConnectSimulatorMutation,
  useGetProjectIconsQuery,
  useListSimulatorsQuery
} from '@monaddesign/client-rtk/endpoints';
import {
  parseSimulatorHistory,
  recordUsedSimulator,
  simulatorHistoryKey,
  sortSimulatorsForProject
} from '@monaddesign/simulator-history';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '../components/Brand';
import { GlassControl } from '../components/GlassControl';
import { SimulatorDeviceGlyph } from '../components/SimulatorDeviceGlyph';
import { Action } from '../components/WorkspaceControls';
import { styles } from '../styles';
import { colors, errorMessage } from '../theme';

export function SimulatorPicker({
  project,
  onConnected,
  onBack
}: {
  project: RemoteProject;
  onConnected: (simulator: IOSSimulator, connection: SimulatorConnectionResponse) => void;
  onBack: () => void;
}) {
  const { data, error: queryError, isFetching, isLoading, refetch } = useListSimulatorsQuery();
  const { data: projectIcons } = useGetProjectIconsQuery(project.id);
  const [connectSimulator, connectState] = useConnectSimulatorMutation();
  const availableSimulators = data ? simulatorSelectors.selectAll(data.simulators) : [];
  const [usedSimulatorUdids, setUsedSimulatorUdids] = useState<string[]>([]);
  const simulators = useMemo(
    () => sortSimulatorsForProject(availableSimulators, usedSimulatorUdids),
    [availableSimulators, usedSimulatorUdids]
  );
  const [selected, setSelected] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(project.targetApps[0]?.bundleIdentifier ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = isLoading || isFetching || connectState.isLoading;
  const error = actionError ?? (queryError ? errorMessage(queryError) : null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(simulatorHistoryKey)
      .then((value) => {
        if (active) setUsedSimulatorUdids(parseSimulatorHistory(value)[project.id] ?? []);
      })
      .catch(() => {
        if (active) setUsedSimulatorUdids([]);
      });
    return () => {
      active = false;
    };
  }, [project.id]);

  useEffect(() => {
    setSelected((current) => (simulators.some(({ udid }) => udid === current) ? current : (simulators[0]?.udid ?? '')));
  }, [simulators]);

  const selectedSimulator = simulators.find(({ udid }) => udid === selected);
  const connect = async () => {
    if (!selectedSimulator || !selectedTarget) return;
    setActionError(null);
    try {
      const connection = await connectSimulator({
        projectId: project.id,
        udid: selectedSimulator.udid,
        bundleIdentifier: selectedTarget
      }).unwrap();
      const nextHistory = recordUsedSimulator({ [project.id]: usedSimulatorUdids }, project.id, selectedSimulator.udid);
      setUsedSimulatorUdids(nextHistory[project.id] ?? []);
      void AsyncStorage.getItem(simulatorHistoryKey)
        .then((value) =>
          AsyncStorage.setItem(
            simulatorHistoryKey,
            JSON.stringify(recordUsedSimulator(parseSimulatorHistory(value), project.id, selectedSimulator.udid))
          )
        )
        .catch(() => {
          /* History should never block an otherwise successful connection. */
        });
      onConnected(selectedSimulator, connection);
    } catch (reason) {
      setActionError(errorMessage(reason));
      void refetch();
    }
  };

  return (
    <SafeAreaView style={styles.pickerRoot}>
      <View style={styles.pickerHeader}>
        <Brand />
        <View style={styles.headerActions}>
          <GlassControl
            contentStyle={styles.textButtonContent}
            glassStyle="clear"
            onPress={onBack}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>All projects</Text>
          </GlassControl>
          <Action
            disabled={busy}
            icon="refresh"
            label="Refresh"
            onPress={() => void refetch()}
          />
        </View>
      </View>
      <View style={styles.pickerBody}>
        <View style={styles.pickerIntro}>
          <Text style={styles.pickerTitle}>{project.name}</Text>
          <Text style={styles.pickerHint}>
            Choose an app and a Simulator. The Mac launches that target before streaming it.
          </Text>
        </View>
        <Text style={styles.pickerSectionLabel}>TARGET APP</Text>
        <View style={styles.targetAppGrid}>
          {project.targetApps.map((app) => (
            <GlassControl
              contentStyle={styles.targetAppContent}
              key={app.bundleIdentifier}
              onPress={() => setSelectedTarget(app.bundleIdentifier)}
              style={[styles.targetAppCard, selectedTarget === app.bundleIdentifier && styles.targetAppCardSelected]}
              tone={selectedTarget === app.bundleIdentifier ? 'selected' : 'neutral'}
            >
              <View style={styles.targetAppIcon}>
                {projectIcons?.icons[app.bundleIdentifier] ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: projectIcons.icons[app.bundleIdentifier] }}
                    style={styles.targetAppIconImage}
                  />
                ) : (
                  <Ionicons
                    color={selectedTarget === app.bundleIdentifier ? colors.accent : colors.muted}
                    name="logo-apple-appstore"
                    size={21}
                  />
                )}
              </View>
              <View style={styles.projectIdentity}>
                <Text style={styles.targetAppName}>{app.name}</Text>
                <Text style={styles.targetAppBundle}>{app.bundleIdentifier}</Text>
              </View>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.targetAppSelection,
                  selectedTarget === app.bundleIdentifier && styles.targetAppSelectionSelected
                ]}
              >
                {selectedTarget === app.bundleIdentifier && <View style={styles.targetAppSelectionDot} />}
              </View>
            </GlassControl>
          ))}
        </View>
        <Text style={styles.pickerSectionLabel}>SIMULATOR</Text>
        <ScrollView
          contentContainerStyle={styles.pickerBodyContent}
          style={styles.pickerScroll}
        >
          <View style={styles.deviceGrid}>
            {simulators.map((item) => (
              <GlassControl
                contentStyle={styles.deviceCardContent}
                key={item.udid}
                onPress={() => setSelected(item.udid)}
                style={styles.deviceCard}
                tone={selected === item.udid ? 'selected' : 'neutral'}
              >
                <SimulatorDeviceGlyph simulator={item} />
                <View style={styles.deviceDetails}>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceRuntime}>{item.runtime}</Text>
                </View>
                <View style={styles.booted}>
                  <View
                    style={[
                      styles.bootedDot,
                      item.state === 'Shutdown' && {
                        backgroundColor: colors.muted
                      }
                    ]}
                  />
                  <Text style={[styles.bootedText, item.connected && styles.connectedText]}>
                    {item.connected ? 'CONNECTED' : item.state.toUpperCase()}
                  </Text>
                </View>
              </GlassControl>
            ))}
            {!busy && simulators.length === 0 && (
              <View style={styles.empty}>
                <Ionicons
                  color="#666a72"
                  name="phone-portrait-outline"
                  size={42}
                />
                <Text style={styles.emptyTitle}>No available Simulators</Text>
                <Text style={styles.emptyText}>Install an iOS Simulator runtime in Xcode on the connected Mac.</Text>
              </View>
            )}
          </View>
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        <GlassControl
          contentStyle={styles.connectButtonContent}
          disabled={!selected || !selectedTarget || busy}
          onPress={() => void connect()}
          style={[styles.connectButton, styles.pickerConnect]}
          tone="accent"
        >
          {busy ? (
            <ActivityIndicator color="#10130e" />
          ) : (
            <Ionicons
              color="#10130e"
              name="play"
              size={18}
            />
          )}
          <Text style={styles.connectText}>
            {busy
              ? selectedSimulator?.state === 'Shutdown'
                ? 'Starting Simulator & app…'
                : 'Opening target app…'
              : selectedSimulator?.state === 'Shutdown'
                ? 'Start & open app'
                : 'Open target app'}
          </Text>
        </GlassControl>
      </View>
    </SafeAreaView>
  );
}
