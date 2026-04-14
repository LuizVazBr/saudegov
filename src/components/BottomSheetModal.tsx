import { useEffect, useRef, useState } from "react";

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  disableBackdropClick?: boolean;
  disableDrag?: boolean;
  maxHeight?: string; 
  className?: string;
  zIndex?: string;
}
 
export default function BottomSheetModal({
  isOpen,
  onClose,
  children,
  disableBackdropClick = false,
  disableDrag = false,
  maxHeight,
  zIndex,
}: BottomSheetModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [startY, setStartY] = useState<number | null>(null);
 
  useEffect(() => {
    if (disableDrag) return; // Se desabilitado, não adiciona listeners
 
    const handleTouchStart = (e: TouchEvent) => setStartY(e.touches[0].clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 100) onClose();
    };
    const sheet = sheetRef.current;
    sheet?.addEventListener("touchstart", handleTouchStart);
    sheet?.addEventListener("touchmove", handleTouchMove);
    return () => {
      sheet?.removeEventListener("touchstart", handleTouchStart);
      sheet?.removeEventListener("touchmove", handleTouchMove);
    };
  }, [startY, onClose, disableDrag]);
 
  if (!isOpen) return null;
 
  return (
    <div
      className={`fixed inset-0 ${zIndex || 'z-[50000]'} flex items-end justify-center bg-black bg-opacity-50`}
      onClick={() => {
        if (!disableBackdropClick) onClose();
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className={`typing-form relative w-full max-w-3xl mx-auto rounded-t-3xl bg-white dark:bg-gray-900 px-6 pb-6 pt-2 transition-transform duration-300 flex flex-col`}
        style={maxHeight ? { maxHeight } : {}}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-400 flex-shrink-0" />
        {children}
      </div>
    </div>
  );
}
