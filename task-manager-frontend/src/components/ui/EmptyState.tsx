export default function EmptyState({ searchMessage }:{ searchMessage: string }) {
  return (
    <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-text-sub">{searchMessage}</p>
    </div>
  );
}