const SCHOOL_PERIOD_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'PLANIFICADO',
  OPEN: 'ABIERTO',
  CLOSED: 'CERRADO',
};

export function getSchoolPeriodStatusLabel(
  status: string,
): string {
  return SCHOOL_PERIOD_STATUS_LABELS[status] ?? status.toUpperCase();
}
