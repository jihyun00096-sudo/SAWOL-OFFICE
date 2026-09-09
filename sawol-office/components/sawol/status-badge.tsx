const styles: Record<string, string> = {
  AVAILABLE: "bg-[#EEF8F2] text-[#2C7B50]",
  WORKING: "bg-[#EEF2FF] text-[#3157D5]",
  WAITING: "bg-[#F4F5F7] text-[#69707C]",
  WAITING_FOR_DATA: "bg-[#F4F0FF] text-[#7655B8]",
  REVIEWING: "bg-[#FFF7E8] text-[#9B6A17]",
  IN_REVIEW: "bg-[#FFF7E8] text-[#9B6A17]",
  APPROVAL_WAIT: "bg-[#FFF0F5] text-[#A93B63]",
  PENDING: "bg-[#FFF0F5] text-[#A93B63]",
  BLOCKED: "bg-[#FFF1F1] text-[#B14444]",
  ERROR: "bg-[#FFF1F1] text-[#B14444]",
  COMPLETED: "bg-[#EEF8F2] text-[#2C7B50]",
  APPROVED: "bg-[#EEF8F2] text-[#2C7B50]",
  REJECTED: "bg-[#FFF1F1] text-[#B14444]",
  CANCELLED: "bg-[#F1F2F4] text-[#7B8089]",
  ON_HOLD: "bg-[#F1F2F4] text-[#7B8089]",
  HIGH: "bg-[#FFF3EC] text-[#B95B26]",
  URGENT: "bg-[#FFF1F1] text-[#B14444]",
  NORMAL: "bg-[#F4F5F7] text-[#69707C]",
  LOW: "bg-[#F4F5F7] text-[#7D838E]",
};

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
        styles[value] ?? "bg-[#F4F5F7] text-[#69707C]"
      }`}
    >
      {label}
    </span>
  );
}
