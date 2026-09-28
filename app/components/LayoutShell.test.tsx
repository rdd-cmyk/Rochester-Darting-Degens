import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import LayoutShell from './LayoutShell';

vi.mock('./Navbar', () => ({ default: ({summerEnabled,onToggleSummer}:{summerEnabled:boolean;onToggleSummer:()=>void}) => <button onClick={onToggleSummer}>Summer: {summerEnabled ? 'On' : 'Off'}</button> }));
vi.mock('./SummerOverlay', () => ({ default: () => <div>Summer decoration</div> }));
it('hydrates saved Summer Off without a markup mismatch', async () => {
  localStorage.setItem('summer-overlay-enabled','false');
  const container=document.createElement('div');
  container.innerHTML=renderToString(<LayoutShell><p>Board</p></LayoutShell>);
  expect(container.textContent).toContain('Summer: On');
  document.body.append(container);
  const onRecoverableError=vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async()=>{root=hydrateRoot(container,<LayoutShell><p>Board</p></LayoutShell>,{onRecoverableError});});
  expect(container.textContent).toContain('Summer: Off');
  expect(onRecoverableError).not.toHaveBeenCalled();
  await act(async()=>root.unmount());container.remove();
});
it('keeps the saved switch interactive',()=>{
  localStorage.setItem('summer-overlay-enabled','false');
  render(<LayoutShell><p>Board</p></LayoutShell>);
  fireEvent.click(screen.getByRole('button',{name:'Summer: Off'}));
  expect(screen.getByRole('button',{name:'Summer: On'})).toBeVisible();
  expect(localStorage.getItem('summer-overlay-enabled')).toBe('true');
});
