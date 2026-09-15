import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('PixelPro Studio V4 Tests', () => {
  it('renders the main UI correctly', () => {
    render(<App />);
    expect(screen.getByText(/Arrastra una imagen aquí/i)).toBeInTheDocument();
  });

  it('initially disables the Undo and Redo buttons because there is no history', () => {
    render(<App />);
    const undoBtn = screen.getByText(/Deshacer/i).closest('button');
    const redoBtn = screen.getByText(/Rehacer/i).closest('button');
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it('toggles light/dark mode', () => {
    const { container } = render(<App />);
    const appWrapper = container.firstChild;
    expect(appWrapper).toHaveClass('dark-theme');
    
    const themeBtn = screen.getByText(/Tema/i).closest('button');
    fireEvent.click(themeBtn);
    expect(appWrapper).toHaveClass('light-theme');
  });
});
