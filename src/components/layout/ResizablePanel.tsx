import React, { useState, useEffect, useRef } from 'react';

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
  children: React.ReactNode;
  position: 'left' | 'right' | 'bottom';
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  direction,
  initialSize,
  minSize = 180,
  maxSize = 800,
  onResize,
  children,
  position,
  className = ''
}) => {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      let newSize = size;
      if (position === 'left') {
        newSize = e.clientX - 48; // subtract activity bar width
      } else if (position === 'right') {
        newSize = window.innerWidth - e.clientX;
      } else if (position === 'bottom') {
        newSize = window.innerHeight - e.clientY - 22; // subtract status bar
      }

      if (newSize >= minSize && newSize <= maxSize) {
        setSize(newSize);
        onResize?.(newSize);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minSize, maxSize, onResize, position, size]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      style={{
        [isHorizontal ? 'width' : 'height']: `${size}px`,
        flexShrink: 0
      }}
      className={`relative flex flex-col ${className}`}
    >
      {/* Handle */}
      {position === 'left' && (
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-[3px] -mr-[1px] cursor-col-resize hover:bg-[#007ACC] transition-colors z-30"
        />
      )}
      {position === 'right' && (
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-[3px] -ml-[1px] cursor-col-resize hover:bg-[#007ACC] transition-colors z-30"
        />
      )}
      {position === 'bottom' && (
        <div
          onMouseDown={startResize}
          className="absolute left-0 right-0 top-0 h-[3px] -mt-[1px] cursor-row-resize hover:bg-[#007ACC] transition-colors z-30"
        />
      )}

      {children}
    </div>
  );
};
