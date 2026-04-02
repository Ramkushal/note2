import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { ViewerToolbar } from './components/ViewerToolbar';
import { PdfViewer } from './components/PdfViewer';
import { MarkdownPanel } from './components/MarkdownPanel';
import { useAnnotationStore } from './store/annotationStore';
import './App.css';

const MIN_PANEL_W = 260;
const MAX_PANEL_W = 640;
const DEFAULT_PANEL_W = 380;

function App() {
    const { setPdfFile, isPanelOpen } = useAnnotationStore();
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
    const [isDark, setIsDark] = useState(false);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_W);
    const [isViewerOpen, setIsViewerOpen] = useState(true);

    // Drag-resize state
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startW = useRef(0);
    const appBodyRef = useRef<HTMLDivElement>(null);

    const handleFileOpen = useCallback(async (file: File) => {
        setLocalFile(file);
        setRemoteUrl(null);
        await setPdfFile(file);
    }, [setPdfFile]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file?.type === 'application/pdf') handleFileOpen(file);
    }, [handleFileOpen]);

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    // Resize handle mouse-down
    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        startX.current = e.clientX;
        startW.current = panelWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [panelWidth]);

    // Global mouse-move / mouse-up handlers
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            // Panel is on the right; dragging left increases its width
            const delta = startX.current - e.clientX;
            const newW = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, startW.current + delta));
            setPanelWidth(newW);
        };

        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return (
        <div
            className="app-root"
            data-theme={isDark ? 'dark' : 'light'}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <Toolbar
                onFileOpen={handleFileOpen}
                isDark={isDark}
                onThemeToggle={() => setIsDark(d => !d)}
                isViewerOpen={isViewerOpen}
                onViewerToggle={() => setIsViewerOpen(v => !v)}
            />

            <div className="app-body" ref={appBodyRef}>
                {/* PDF Viewer */}
                {/* PDF Viewer — always mounted to preserve PDF state; hidden via CSS when closed */}
                <div className="viewer-pane" style={isViewerOpen ? undefined : { display: 'none' }}>
                    <ViewerToolbar onClose={() => setIsViewerOpen(false)} />
                    <PdfViewer file={localFile} url={remoteUrl} onFileOpen={handleFileOpen} />
                </div>


                {/* Resize handle — only visible when panel is open */}
                {isPanelOpen && isViewerOpen && (
                    <div
                        className="resize-handle"
                        onMouseDown={onResizeStart}
                        title="Drag to resize"
                    >
                        <div className="resize-handle-bar" />
                    </div>
                )}

                {/* Notes Panel */}
                {isPanelOpen && (
                    <div
                        className="panel-pane"
                        style={isViewerOpen ? { width: panelWidth } : { flex: 1 }}
                    >
                        <MarkdownPanel />
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;

