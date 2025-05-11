# Frontend Setup Guide

This guide explains how to set up and build the frontend for the Fisqos project.

## Prerequisites

- Node.js (v16 or later)
- npm (v8 or later)

## Steps

### 1. Install Dependencies
Navigate to the `public/` directory and install the required dependencies:

```bash
cd public
npm install
```

### 2. Build the Frontend
To build the frontend for production, run:

```bash
npm run build
```

The bundled files will be output to the `dist/` directory.

### 3. Development Mode
To run the frontend in development mode with live reloading, use:

```bash
npm run watch
```

### 4. Lint and Format Code
- To lint the TypeScript files:

  ```bash
  npm run lint
  ```

- To fix linting issues:

  ```bash
  npm run lint:fix
  ```

- To format code:

  ```bash
  npm run format
  ```

### 5. Check TypeScript
To check TypeScript types without emitting files, run:

```bash
npm run check
```

## Notes
- The entry point for the frontend is `src/ts/index.ts`.
- The output bundle is located in the `dist/` directory as `bundle.js`.
- Source maps are enabled for easier debugging in development.

For further details, refer to the `webpack.config.js` file in the `public/` directory.