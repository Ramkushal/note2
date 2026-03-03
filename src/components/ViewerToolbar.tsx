/**
 * ViewerToolbar — PDF-specific controls
 * Sits at the top of the viewer-pane as the panel chrome strip.
 * Contains: tool selector, color swatches, zoom, page navigation, close button.
 */

import React from 'react';
import { useAnnotationStore, COLOR_PRESETS } from '../store/annotationStore';

interface ViewerToolbarProps {
    onClose: () => void;
}

export const ViewerToolbar: React.FC<ViewerToolbarProps> = ({ onClose }) => {
    const {
        scale, setScale,
        activeTool, setActiveTool,
        activeColor, setActiveColor,
        currentPage, totalPages, setCurrentPage,
    } = useAnnotationStore();

    const zoomIn = () => setScale(Math.min(scale + 0.25, 4));
    const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
    const zoomReset = () => setScale(1.5);

    return (
        <div className="viewer-toolbar">

            {/* ── Tool selector ── */}
            <div className="tool-segment">
                <button
                    className={`tool-pill ${activeTool === 'select' ? 'active' : ''}`}
                    onClick={() => setActiveTool('select')}
                    title="Select (V)"
                >
                    <span className="tool-pill-icon">◻</span> Select
                </button>
                <button
                    className={`tool-pill ${activeTool === 'highlight' ? 'active' : ''}`}
                    onClick={() => setActiveTool('highlight')}
                    title="Highlight (H)"
                >
                    <span className="tool-pill-icon">🖊</span> Highlight
                </button>
            </div>

            <div className="vt-divider" />

            {/* ── Color swatches ── */}
            <div className="vt-group color-group">
                {COLOR_PRESETS.map(({ label, color }) => (
                    <button
                        key={label}
                        className={`color-swatch ${JSON.stringify(activeColor) === JSON.stringify(color) ? 'active' : ''}`}
                        title={label}
                        style={{
                            backgroundColor: `rgb(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)})`,
                        }}
                        onClick={() => setActiveColor(color)}
                    />
                ))}
            </div>

            <div className="vt-divider" />

            {/* ── Zoom ── */}
            <div className="vt-group zoom-group">
                <button className="zoom-btn" onClick={zoomOut} title="Zoom out (−)" disabled={scale <= 0.5}>−</button>
                <button className="zoom-label" onClick={zoomReset} title="Reset zoom">
                    {Math.round(scale * 100)}%
                </button>
                <button className="zoom-btn" onClick={zoomIn} title="Zoom in (+)" disabled={scale >= 4}>+</button>
            </div>

            <div className="vt-divider" />

            {/* ── Page navigation ── */}
            <div className="vt-group page-nav">
                <button
                    className="page-btn"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    title="Previous page"
                >‹</button>
                <span className="page-indicator">{currentPage} / {totalPages || '—'}</span>
                <button
                    className="page-btn"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    title="Next page"
                >›</button>
            </div>

            {/* ── Spacer pushes close to the right ── */}
            <div className="vt-spacer" />

            {/* ── Close panel ── */}
            <button
                className="viewer-close-btn"
                onClick={onClose}
                title="Close PDF viewer"
                aria-label="Close PDF viewer"
            >
                ✕
            </button>

        </div>
    );
};
