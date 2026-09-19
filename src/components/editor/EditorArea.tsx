import React from 'react';
import { EditorTabs } from './EditorTabs';
import { Breadcrumbs } from './Breadcrumbs';
import { MonacoEditorContainer } from './MonacoEditorContainer';
import { DiffViewerModal } from './DiffViewerModal';
import { FileDiffDrawer } from './FileDiffDrawer';

export const EditorArea: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1E1E1E] min-w-0 relative">
      <EditorTabs />
      <Breadcrumbs />
      <div className="flex-1 overflow-hidden relative">
        <MonacoEditorContainer />
        <FileDiffDrawer />
      </div>
      <DiffViewerModal />
    </div>
  );
};
