export default function LoadingState({ loadMessage = 'Loading' }: { loadMessage?: string }){
  return (
    <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p className="ml-3 text-text-sub">{loadMessage}</p>
      </div>
  )
}