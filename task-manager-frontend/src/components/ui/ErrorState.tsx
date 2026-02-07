interface ErrorStateProps {
  error: string;
}

export default function ErrorState({ error }: ErrorStateProps){
  return (
    <div className="p-6 text-center rounded-md border animate-in fade-in duration-500
        bg-failure/10 border-failure/20 text-failure"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm opacity-90 mb-4">{error}</p>
        
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 rounded-md bg-failure text-white font-bold hover:brightness-110 transition-all shadow-sm"
        >
          Try Again
        </button>
      </div>
  )
}