interface PopupProps {
  title: string;
  close: () => void;
  body: string;
  handleConfirm: () => void;
  actionText?: string;
  actionButtonVariant: "failure" | "success" | "accent"
}

export default function Popup({ title, close, body, handleConfirm, actionText = "Confirm", actionButtonVariant = "failure"   }: PopupProps) {
  const actionButtonClass = `bg-${actionButtonVariant}`
  
  return (
    <div className='fixed w-screen h-screen z-100 bg-gray-800/80 backdrop-blur-sm top-0 left-0 flex items-center justify-center'>
      <div className='bg-surface rounded-2xl overflow-hidden w-4/5 md:max-w-2xl'>
        <header className='bg-accent p-4 text-text-inverse flex justify-between items-center'>
          <h1>{title}</h1>
          <button className="text-xl" aria-label='close' onClick={close}>&times;</button>
        </header>
        <section className='p-4'>
          {body}
        </section>
        <footer className='p-4 flex gap-4 justify-end'>
          <button 
            className="px-4 py-2 rounded-lg font-medium hover:bg-surface-muted transition-colors " 
            onClick={close}
          >
              Cancel
          </button>
          <button 
            className={`px-4 py-2 rounded-lg font-bold text-text-inverse hover:brightness-110 transition-all shadow-md active:scale-95 ${actionButtonClass}`} 
            onClick={handleConfirm}
          >
            {actionText}
          </button>
        </footer>
      </div>
    </div>
  )
}
