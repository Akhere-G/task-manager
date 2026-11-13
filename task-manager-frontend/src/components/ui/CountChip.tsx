export default function CountChip({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-block rounded-full bg-brand/5 px-2 py-0.5 align-middle text-xs font-medium text-[color-mix(in_oklab,var(--color-brand)_70%,black)]">
      {count}
    </span>
  );
}
