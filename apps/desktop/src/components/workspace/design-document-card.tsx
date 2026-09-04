import { DesignDocumentCard as SharedDesignDocumentCard } from '@monaddesign/ui/business/design-document-card';
import { useCallback } from 'react';

import { useDesktopApp } from '@/desktop-app-provider';

export function DesignDocumentCard() {
  const { activeProject, isAnnotationMode, isAXTreeOpen, runtimeClient } = useDesktopApp();
  const loadDocument = useCallback(
    (projectId: string) => {
      if (!runtimeClient) throw new Error('Core is not available.');
      return runtimeClient.projectDesignDocument(projectId);
    },
    [runtimeClient]
  );

  if (!activeProject || !runtimeClient) return null;
  return (
    <SharedDesignDocumentCard
      collapse={isAnnotationMode || isAXTreeOpen}
      loadDocument={loadDocument}
      projectId={activeProject.id}
    />
  );
}
