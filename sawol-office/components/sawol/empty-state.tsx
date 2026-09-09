export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#DDE1E7] bg-white px-6 py-12 text-center">
      <div className="mx-auto h-2 w-2 rounded-full bg-[#CBD0D8]" />
      <p className="mt-4 text-[14px] font-semibold text-[#343842]">{title}</p>
      <p className="mx-auto mt-2 max-w-[420px] text-[12px] leading-5 text-[#9297A1]">
        {description}
      </p>
    </div>
  );
}
