import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePlanStore } from '../store/usePlanStore';
import { worldToScreen, type Viewport } from '../geometry/viewport';

interface LabelEditorOverlayProps {
  viewport: Viewport;
}

export function LabelEditorOverlay({ viewport }: LabelEditorOverlayProps) {
  const pendingLabel = usePlanStore((s) => s.interaction.pendingLabel);
  const addLabel = usePlanStore((s) => s.addLabel);
  const setInteraction = usePlanStore((s) => s.setInteraction);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (pendingLabel) {
      setText('');
      finishedRef.current = false;
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [pendingLabel]);

  if (!pendingLabel) return null;

  const screen = worldToScreen(viewport, pendingLabel.position);

  function commit(currentText: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const trimmed = currentText.trim();
    if (trimmed && pendingLabel) {
      addLabel({ id: uuidv4(), position: pendingLabel.position, text: trimmed, fontSize: pendingLabel.fontSize });
    }
    setInteraction({ pendingLabel: null });
  }

  function cancel() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setInteraction({ pendingLabel: null });
  }

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(text);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
        e.stopPropagation();
      }}
      onBlur={() => commit(text)}
      style={{
        position: 'absolute',
        left: screen.x,
        top: screen.y,
        fontSize: Math.max(12, pendingLabel.fontSize * viewport.scale),
        transform: 'translateY(-2px)',
        minWidth: '4ch',
      }}
      className="rounded border border-blue-500 bg-white px-1 outline-none shadow-sm"
      placeholder="Label text"
    />
  );
}
