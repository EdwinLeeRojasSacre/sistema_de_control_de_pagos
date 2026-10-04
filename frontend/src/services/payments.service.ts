import {
  api,
} from '@/lib/axios';

import type {
  CreatePaymentInput,
  FamilyPaymentStatus,
  GetPaymentsParams,
  Payment,
  PaymentVoucherLinks,
  PaymentsResponse,
  UpdatePaymentVoucherLinksInput,
  VoucherFileMode,
} from '@/types/payments';

export async function getPaymentVoucherLinks(
  paymentId: string,
  voucherId: string,
): Promise<PaymentVoucherLinks> {
  const response = await api.get<PaymentVoucherLinks>(
    `/payments/${paymentId}/vouchers/${voucherId}/links`,
  );

  return response.data;
}

export async function updatePaymentVoucherLinks(
  paymentId: string,
  voucherId: string,
  input: UpdatePaymentVoucherLinksInput,
): Promise<void> {
  await api.patch(
    `/payments/${paymentId}/vouchers/${voucherId}/links`,
    input,
  );
}

export async function getPayments(
  params?: GetPaymentsParams,
): Promise<PaymentsResponse> {
  const response =
    await api.get<PaymentsResponse>(
      '/payments',
      {
        params,
      },
    );

  return response.data;
}

export async function getPaymentById(
  id: string,
): Promise<Payment> {
  const response =
    await api.get<Payment>(
      `/payments/${id}`,
    );

  return response.data;
}

export async function getFamilyPaymentStatus(
  familyGroupId: string,
  schoolPeriodId: string,
): Promise<FamilyPaymentStatus> {
  const response =
    await api.get<FamilyPaymentStatus>(
      '/payments/family-status',
      {
        params: {
          familyGroupId,
          schoolPeriodId,
        },
      },
    );

  return response.data;
}

export async function getVoucherFileBlob(
  paymentId: string,
  voucherId: string,
  mode: VoucherFileMode,
): Promise<Blob> {
  const response =
    await api.get<Blob>(
      `/payments/${paymentId}/vouchers/${voucherId}/file`,
      {
        params: {
          mode,
        },

        responseType:
          'blob',
      },
    );

  return response.data;
}

export async function downloadVoucherFile(
  paymentId: string,
  voucherId: string,
  filename: string,
): Promise<void> {
  const blob =
    await getVoucherFileBlob(
      paymentId,
      voucherId,
      'download',
    );

  const url =
    window.URL.createObjectURL(
      blob,
    );

  try {
    const anchor =
      document.createElement(
        'a',
      );

    anchor.href =
      url;

    anchor.download =
      filename ||
      'voucher';

    document.body.appendChild(
      anchor,
    );

    anchor.click();
    anchor.remove();
  } finally {
    window.URL.revokeObjectURL(
      url,
    );
  }
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<Payment> {
  const formData =
    new FormData();

  formData.append(
    'schoolPeriodId',
    input.schoolPeriodId,
  );

  formData.append(
    'familyGroupId',
    input.familyGroupId,
  );

  formData.append(
    'paymentDate',
    input.paymentDate,
  );

  formData.append(
    'includeApafa',
    String(
      input.includeApafa,
    ),
  );

  for (
    const studentId
    of input.studentIds
  ) {
    formData.append(
      'studentIds',
      studentId,
    );
  }

  if (input.studentIds.length === 0) {
    formData.append(
      'studentIds',
      '[]',
    );
  }

  if (
    input.operationNumber
      ?.trim()
  ) {
    formData.append(
      'operationNumber',
      input.operationNumber
        .trim(),
    );
  }

  if (
    input.observations
      ?.trim()
  ) {
    formData.append(
      'observations',
      input.observations
        .trim(),
    );
  }

  formData.append(
    'voucherAssociations',
    JSON.stringify(
      input
        .voucherAssociations,
    ),
  );

  for (
    const voucher
    of input.vouchers
  ) {
    formData.append(
      'vouchers',
      voucher,
    );
  }

  const response =
    await api.post<Payment>(
      '/payments',
      formData,
      {
        headers: {
          'Content-Type':
            'multipart/form-data',
        },
      },
    );

  return response.data;
}
