import React, { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { WorkspacePage } from './pages/WorkspacePage';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [templateKey, setTemplateKey] = useState<string | undefined>();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToWorkspace = (workspaceId: string, initialTpl?: string) => {
    const newPath = `/w/${workspaceId}`;
    window.history.pushState({}, '', newPath);
    setTemplateKey(initialTpl);
    setCurrentPath(newPath);
  };

  // Match /w/:id
  const match = currentPath.match(/^\/w\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const workspaceId = match[1];
    return <WorkspacePage workspaceId={workspaceId} initialTemplateKey={templateKey} />;
  }

  return <LandingPage onNavigateToWorkspace={navigateToWorkspace} />;
};
