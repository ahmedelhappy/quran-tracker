import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useDraggable } from './useDraggable';

let renders = 0;
function Box() {
  renders++;
  const { ref, style, dragHandlers } = useDraggable(null);
  return <div ref={ref} style={style} data-testid="box" {...dragHandlers} />;
}

describe('useDraggable (M-10)', () => {
  afterEach(cleanup);

  it('moves the element during a drag without re-rendering, and commits once on release', () => {
    renders = 0;
    const { getByTestId } = render(<Box />);
    const box = getByTestId('box');
    const before = renders;
    fireEvent.pointerDown(box, { button: 0, clientX: 100, clientY: 100 });
    for (let i = 1; i <= 10; i++) {
      act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + i * 5, clientY: 100 + i * 3 })); });
    }
    expect(renders).toBe(before);
    expect(box.style.transform).toBe('translate(50px, 30px)');
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 150, clientY: 130 })); });
    expect(renders).toBe(before + 1);
    expect(box.style.transform).toBe('translate(50px, 30px)');
    // Nothing more happens once released.
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 300 })); });
    expect(box.style.transform).toBe('translate(50px, 30px)');
  });
});
