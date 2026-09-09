export function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-[13px] font-semibold text-[#272A30]">{title}</h2>
        {description ? (
          <p className="mt-1 text-[10px] leading-5 text-[#9297A1]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
