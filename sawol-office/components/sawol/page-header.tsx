export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold text-[#3157D5] sm:text-[12px]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-1.5 break-keep text-[24px] font-bold leading-[1.25] tracking-[-0.04em] text-[#17181C] sm:text-[30px]">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 max-w-[680px] break-keep text-[12px] leading-5 text-[#7B818C] sm:text-[13px] sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
  );
}
