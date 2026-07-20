# Turing Machine React

A plain React version of the Turing Machine Assistant game using Vite, Tailwind CSS, and shadcn/ui.

## Features

- Game logic for the Turing Machine board game
- Interactive validator system with multiple difficulty levels (4, 5, or 6 columns)
- Helper tab for tracking eliminated numbers
- Responsive design with Tailwind CSS
- Built with shadcn/ui components

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to play the game.

### Build

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

- `src/App.jsx` - Main app component
- `src/components/` - React components
  - `ui/` - shadcn/ui components
  - `Header.jsx` - Game header with column labels
  - `CodeInputRow.jsx` / `CodeInputCell.jsx` - Code input interface
  - `ValidatorRow.jsx` / `ValidatorCell.jsx` - Validator cells
  - `CodeHelper.jsx` - Helper table for tracking numbers
- `src/hooks/useGame.js` - Game logic hook
- `src/lib/utils.js` - Utility functions

## Technologies

- React 19
- Vite
- Tailwind CSS 4
- shadcn/ui
- Radix UI
