import axios from 'axios';

import {
  api,
} from '@/lib/axios';

import type {
  ApafaReportParams,
  ApafaReportResponse,
  ReportExportFormat,
  ReportSummary,
  ReportSummaryParams,
  PaymentsReportParams,
  PaymentsReportResponse,
  TallerReportParams,
  TallerReportResponse,
} from '@/types/reports';

export async function getPaymentsReport(params: PaymentsReportParams): Promise<PaymentsReportResponse> {
  return (await api.get<PaymentsReportResponse>('/reports/payments', { params })).data;
}

export async function exportPaymentsReport(params: PaymentsReportParams, format: ReportExportFormat): Promise<void> {
  const response = await api.get<Blob>(`/reports/payments/export/${format}`, { params, responseType: 'blob' });
  downloadBlob(response.data, getFilenameFromHeaders(response.headers['content-disposition'], `reporte-pagos.${format}`));
}

export async function getReportSummary(
  params: ReportSummaryParams,
): Promise<ReportSummary> {
  const response =
    await api.get<ReportSummary>(
      '/reports/summary',
      {
        params,
      },
    );

  return response.data;
}

export async function getApafaReport(
  params:
    ApafaReportParams,
): Promise<ApafaReportResponse> {
  const response =
    await api.get<ApafaReportResponse>(
      '/reports/apafa',
      {
        params,
      },
    );

  return response.data;
}

export async function getTallerReport(
  params:
    TallerReportParams,
): Promise<TallerReportResponse> {
  const response =
    await api.get<TallerReportResponse>(
      '/reports/taller',
      {
        params,
      },
    );

  return response.data;
}

export async function exportApafaReport(
  params:
    ApafaReportParams,
  format:
    ReportExportFormat,
): Promise<void> {
  const response =
    await api.get<Blob>(
      `/reports/apafa/export/${format}`,
      {
        params,
        responseType:
          'blob',
      },
    );

  downloadBlob(
    response.data,
    getFilenameFromHeaders(
      response.headers[
        'content-disposition'
      ],
      format === 'xlsx'
        ? 'reporte-apafa.xlsx'
        : 'reporte-apafa.pdf',
    ),
  );
}

export async function exportTallerReport(
  params:
    TallerReportParams,
  format:
    ReportExportFormat,
): Promise<void> {
  const response =
    await api.get<Blob>(
      `/reports/taller/export/${format}`,
      {
        params,
        responseType:
          'blob',
      },
    );

  downloadBlob(
    response.data,
    getFilenameFromHeaders(
      response.headers[
        'content-disposition'
      ],
      format === 'xlsx'
        ? 'reporte-taller.xlsx'
        : 'reporte-taller.pdf',
    ),
  );
}

function getFilenameFromHeaders(
  contentDisposition:
    string | undefined,
  fallback:
    string,
): string {
  if (
    !contentDisposition
  ) {
    return fallback;
  }

  const match =
    contentDisposition.match(
      /filename="?([^"]+)"?/i,
    );

  return (
    match?.[1] ??
    fallback
  );
}

function downloadBlob(
  blob: Blob,
  filename: string,
): void {
  const url =
    window.URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  window.URL.revokeObjectURL(
    url,
  );
}

export function getReportError(
  error: unknown,
): string {
  if (
    axios.isAxiosError(error)
  ) {
    const message =
      error.response
        ?.data?.message;

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }

    if (
      Array.isArray(
        message,
      ) &&
      message.every(
        (item) =>
          typeof item ===
          'string',
      )
    ) {
      return message.join(
        '. ',
      );
    }

    if (
      error.response
        ?.status === 401
    ) {
      return 'Tu sesión no es válida. Inicia sesión nuevamente.';
    }

    if (
      error.response
        ?.status === 403
    ) {
      return 'No tienes permisos para consultar reportes.';
    }
  }

  return 'No fue posible completar la consulta del reporte.';
}
