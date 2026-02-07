import { useEffect } from "react";

interface PopupProps {
  title: string;
  close: () => void;
  handleConfirm?: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  actionText?: string;
  actionButtonVariant?: "primary" | "secondary" | "warning" | "success" | "failure"
}

export default function Popup({ 
  title, 
  close, 
  handleConfirm,
  children, 
  showCloseButton = true,
  actionText = "Confirm", 
  actionButtonVariant = "failure"   
}: PopupProps) {
  const actionButtonClass = `btn-${actionButtonVariant}`
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  return (
    <div className='fixed w-screen h-screen z-100 bg-gray-800/80 backdrop-blur-sm top-0 left-0 flex items-center justify-center'>
      <div className='card overflow-hidden w-4/5 md:max-w-2xl'>
        <header className='bg-accent p-4 text-text-inverse flex justify-between items-center'>
          <h1>{title}</h1>
          <button className="text-xl" aria-label='close' onClick={close}>&times;</button>
        </header>
        <section className='p-4'>
          {children}
        </section>
        <footer className={`gap-4 flex justify-end ${(showCloseButton || handleConfirm) && "p-4"}`}>
        {showCloseButton && (
          <button 
            className="px-4 py-2 rounded-md font-medium hover:bg-surface-muted transition-colors " 
            onClick={close}
          >
              Cancel
          </button>
        )}
          {handleConfirm && (
            <button 
              className={actionButtonClass} 
              onClick={handleConfirm}
            >
              {actionText}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
