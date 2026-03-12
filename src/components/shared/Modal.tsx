import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  height?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-2xl',
  height = 'max-h-[85vh]',
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number; 

    if (isOpen) {
      setIsMounted(true);
      // Double RAF to ensure layout is computed before adding transition class
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      setIsMounted(false);
      document.body.style.overflow = '';
    }

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div 
        ref={modalRef}
        className={`relative w-full ${width} ${height} bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <h3 id="modal-title" className="font-bold text-lg text-slate-800">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
