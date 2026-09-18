import React from 'react';
import { EditorTabs } from './EditorTabs';
import { Breadcrumbs } from './Breadcrumbs';
import { MonacoEditorContainer } from './MonacoEditorContainer';
import { DiffViewerModal } from './DiffViewerModal';

export const EditorArea: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1E1E1E] min-w-0">
      <EditorTabs />
      <Breadcrumbs />
      <MonacoEditorContainer />
      <DiffViewerModal />
    </div>
  );
};
