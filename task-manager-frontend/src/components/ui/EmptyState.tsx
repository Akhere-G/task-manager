export default function EmptyState({ searchMessage }:{ searchMessage: string }) {
  return (
    <div className="w-full min-w-max text-center px-2 py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-md">
      <p className="text-text-sub">{searchMessage}</p>
    </div>
  );
}