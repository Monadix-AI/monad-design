import type { ProjectDesignDocument } from '@monaddesign/client-contract';
import type { ClientApi } from '@monaddesign/client-rtk/client-api';

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, errorMessage } from '../theme';
import { GlassControl } from './GlassControl';

export function DesignDocumentPanel({
  api,
  projectId,
  showTrigger = true
}: {
  api: ClientApi;
  projectId: string;
  showTrigger?: boolean;
}) {
  const [expanded, setExpanded] = useState(!showTrigger);
  const [data, setData] = useState<ProjectDesignDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry deliberately restarts the document subscription.
  useEffect(() => {
    if (showTrigger && !expanded) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const document = await api.projectDesignDocument(projectId);
        if (!cancelled) {
          setData(document);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) setError(errorMessage(reason));
      } finally {
        if (!cancelled) timer = setTimeout(load, 2000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [api, projectId, expanded, retry, showTrigger]);
  return (
    <View style={styles.section}>
      {showTrigger && (
        <GlassControl
          accessibilityState={{ expanded }}
          contentStyle={styles.buttonContent}
          onPress={() => setExpanded(!expanded)}
          solid
          style={styles.button}
        >
          <Text style={styles.title}>DESIGN.md</Text>
          <Text style={styles.help}>{expanded ? 'Hide' : 'View design language'}</Text>
        </GlassControl>
      )}
      {(!showTrigger || expanded) && (
        <View style={styles.document}>
          {!data && !error && <ActivityIndicator color={colors.accent} />}
          {error && (
            <>
              <Text
                accessibilityRole="alert"
                style={styles.error}
              >
                {error}
              </Text>
              <GlassControl
                contentStyle={styles.buttonContent}
                onPress={() => setRetry((value) => value + 1)}
                solid
                style={styles.button}
              >
                <Text style={styles.title}>Retry</Text>
              </GlassControl>
            </>
          )}
          {data &&
            (data.exists ? (
              <Text
                selectable
                style={styles.body}
              >
                {data.content}
              </Text>
            ) : (
              <Text style={styles.help}>Add DESIGN.md to the project root to preview its design language here.</Text>
            ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  button: { minHeight: 44, borderRadius: 10 },
  buttonContent: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.text, fontSize: 13, fontWeight: '600' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  document: { gap: 12, paddingTop: 16 },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 13 }
});
