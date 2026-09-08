import type { ComponentProps } from 'react';

import { useWorkspaceColors } from '../workspace-theme';
import { GlassControl } from './GlassControl';

export function WorkspacePanelControl(props: ComponentProps<typeof GlassControl>) {
  const colors = useWorkspaceColors();
  return (
    <GlassControl
      {...props}
      palette={colors}
    />
  );
}
