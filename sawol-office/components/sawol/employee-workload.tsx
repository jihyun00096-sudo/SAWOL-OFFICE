type EmployeeRow = {
  id: string;
  name: string;
  employee_code: string;
  waiting: number;
  inProgress: number;
  review: number;
  pendingApproval: number;
  error: number;
};

export function EmployeeWorkload({
  employees,
}: {
  employees: EmployeeRow[];
}) {
  const active = employees
    .filter(
      (employee) =>
        employee.waiting +
          employee.inProgress +
          employee.review +
          employee.pendingApproval +
          employee.error >
        0,
    )
    .sort(
      (a, b) =>
        b.inProgress +
        b.review +
        b.pendingApproval +
        b.waiting +
        b.error -
        (a.inProgress +
          a.review +
          a.pendingApproval +
          a.waiting +
          a.error),
    );

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div>
        <p className="text-[13px] font-semibold">직원 작업량</p>
        <p className="mt-1 text-[10px] text-[#8B919C]">
          현재 업무가 배정된 직원만 표시합니다.
        </p>
      </div>

      {!active.length ? (
        <div className="mt-5 rounded-[14px] bg-[#F7F8FA] p-5 text-center">
          <p className="text-[11px] text-[#858B96]">
            현재 업무가 배정된 직원이 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {active.map((employee) => (
            <div
              key={employee.id}
              className="rounded-[14px] border border-[#ECEEF2] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold">
                    {employee.name}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#A0A5AE]">
                    {employee.employee_code}
                  </p>
                </div>

                <p className="text-[10px] font-semibold text-[#3157D5]">
                  작업 중 {employee.inProgress}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-[9px] bg-[#F7F8FA] p-2">
                  <p className="text-[8px] text-[#999EA7]">대기</p>
                  <p className="mt-1 text-[11px] font-semibold">
                    {employee.waiting}
                  </p>
                </div>
                <div className="rounded-[9px] bg-[#F7F8FA] p-2">
                  <p className="text-[8px] text-[#999EA7]">검수</p>
                  <p className="mt-1 text-[11px] font-semibold">
                    {employee.review}
                  </p>
                </div>
                <div className="rounded-[9px] bg-[#F7F8FA] p-2">
                  <p className="text-[8px] text-[#999EA7]">승인</p>
                  <p className="mt-1 text-[11px] font-semibold">
                    {employee.pendingApproval}
                  </p>
                </div>
                <div className="rounded-[9px] bg-[#FFF4F4] p-2">
                  <p className="text-[8px] text-[#B67979]">오류</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#A94A4A]">
                    {employee.error}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
