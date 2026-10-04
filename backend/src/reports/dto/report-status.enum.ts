export const REPORT_STATUSES = [
  'ALL',
  'PAGADO',
  'NO_PAGADO',
] as const;

export type ReportStatus =
  (typeof REPORT_STATUSES)[number];