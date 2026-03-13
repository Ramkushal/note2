# A'note

An PDF annotation viewer built with React, TypeScript, Vite, and Electron. It features advanced PDF highlighting, commenting, and a robust Markdown notes architecture that syncs with your PDF annotations.

## Features

- **PDF Viewing & Annotation**: View PDFs and add highlights.
- **Enterprise-grade Markdown Notes**: Dedicated Markdown notes synchronized with PDF highlights.
- **Bidirectional Linking**: Seamless navigation between PDF highlights and their corresponding Markdown sections.
- **Local Storage**: Uses `idb` for robust local database storage.
- **Desktop Application**: Packaged as a standalone desktop application using Electron.
- **Modern Tech Stack**: Built with React 19, TypeScript, Zustand for state management, and Vite for fast development.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **State Management**: Zustand
- **PDF Rendering & Manipulation**: `pdfjs-dist`, `pdf-lib`
- **Markdown Rendering**: `react-markdown`
- **Desktop Framework**: Electron, Electron Builder
- **Database**: IndexedDB (via `idb`)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

1. Install dependencies:

```bash
npm install
```

### Development

Run the frontend development server:

```bash
npm run dev
```

Run the Electron desktop app in development mode:

```bash
npm run electron:dev
```

### Building for Production

To build the executable for Windows:

```bash
npm run dist
```

The generated application will be located in the `release` directory.
