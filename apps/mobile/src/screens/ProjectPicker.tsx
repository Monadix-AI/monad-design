import type { RemoteProject } from '../types';

import { Ionicons } from '@expo/vector-icons';
import { projectSelectors, useListProjectsQuery, useOpenProjectMutation } from '@monaddesign/client-rtk';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '../components/Brand';
import { GlassControl } from '../components/GlassControl';
import { Action } from '../components/WorkspaceControls';
import { styles } from '../styles';
import { colors, errorMessage } from '../theme';

export function ProjectPicker({
  onForget,
  onOpen
}: {
  onForget: () => void;
  onOpen: (project: RemoteProject) => void;
}) {
  const { data, error: queryError, isFetching, isLoading, refetch } = useListProjectsQuery({ limit: 100, offset: 0 });
  const [openProject] = useOpenProjectMutation();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const projects = data ? projectSelectors.selectAll(data.projects) : [];
  const busy = isLoading || isFetching;
  const error = actionError ?? (queryError ? errorMessage(queryError) : null);

  const open = async (project: RemoteProject) => {
    setOpeningId(project.id);
    setActionError(null);
    try {
      onOpen(await openProject(project.id).unwrap());
    } catch (reason) {
      setActionError(errorMessage(reason));
      void refetch();
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <SafeAreaView style={styles.projectRoot}>
      <View style={styles.pickerHeader}>
        <Brand />
        <View style={styles.headerActions}>
          <GlassControl
            contentStyle={styles.textButtonContent}
            glassStyle="clear"
            onPress={onForget}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Change desktop</Text>
          </GlassControl>
          <Action
            disabled={busy}
            icon="refresh"
            label="Refresh"
            onPress={() => void refetch()}
          />
        </View>
      </View>
      <View style={styles.projectBody}>
        <View style={styles.projectHeading}>
          <View>
            <Text style={styles.projectTitle}>Projects</Text>
            <Text style={styles.projectHint}>Available on the paired desktop</Text>
          </View>
          <View style={styles.pairedState}>
            <View style={styles.pairedDot} />
            <Text style={styles.pairedText}>Desktop connected</Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.projectListContent}
          style={styles.projectList}
        >
          {projects.map((project) => (
            <GlassControl
              contentStyle={styles.projectItemContent}
              disabled={openingId !== null}
              key={project.id}
              onPress={() => void open(project)}
              style={styles.projectItem}
            >
              <View style={styles.projectIcon}>
                <Ionicons
                  color={colors.accent}
                  name="folder-open-outline"
                  size={22}
                />
              </View>
              <View style={styles.projectIdentity}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectMeta}>
                  {project.targetApps.length === 1
                    ? project.targetApps[0]?.bundleIdentifier
                    : `${project.targetApps.length} target apps`}
                </Text>
              </View>
              {openingId === project.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons
                  color={colors.muted}
                  name="chevron-forward"
                  size={20}
                />
              )}
            </GlassControl>
          ))}
          {busy && projects.length === 0 && (
            <View style={styles.projectStatus}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.projectStatusText}>Loading desktop projects…</Text>
            </View>
          )}
          {!busy && projects.length === 0 && !error && (
            <View style={styles.projectStatus}>
              <Ionicons
                color="#666a72"
                name="folder-open-outline"
                size={38}
              />
              <Text style={styles.emptyTitle}>No projects on this desktop</Text>
              <Text style={styles.emptyText}>
                Add a project from the Monad Design desktop home screen, then refresh.
              </Text>
            </View>
          )}
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}
