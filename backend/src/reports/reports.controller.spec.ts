import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Response,
} from 'express';

import {
  ReportsController,
} from './reports.controller.js';

import {
  ReportsService,
} from './reports.service.js';

const PERIOD_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'ReportsController',
  () => {
    let controller:
      ReportsController;

    let service: {
      getSummary:
        ReturnType<
          typeof vi.fn
        >;

      getApafaReport:
        ReturnType<
          typeof vi.fn
        >;

      getTallerReport:
        ReturnType<
          typeof vi.fn
        >;

      exportApafaXlsx:
        ReturnType<
          typeof vi.fn
        >;

      exportApafaPdf:
        ReturnType<
          typeof vi.fn
        >;

      exportTallerXlsx:
        ReturnType<
          typeof vi.fn
        >;

      exportTallerPdf:
        ReturnType<
          typeof vi.fn
        >;
    };

    beforeEach(() => {
      service = {
        getSummary:
          vi.fn(),

        getApafaReport:
          vi.fn(),

        getTallerReport:
          vi.fn(),

        exportApafaXlsx:
          vi.fn(),

        exportApafaPdf:
          vi.fn(),

        exportTallerXlsx:
          vi.fn(),

        exportTallerPdf:
          vi.fn(),
      };

      controller =
        new ReportsController(
          service as unknown as
            ReportsService,
        );
    });

    it(
      'is defined',
      () => {
        expect(
          controller,
        ).toBeDefined();
      },
    );

    it(
      'delegates summary query to the service',
      async () => {
        const query = {
          schoolPeriodId:
            PERIOD_ID,
        };

        const expected = {
          schoolPeriod: {
            id:
              PERIOD_ID,
            year:
              2026,
          },

          apafa: {
            totalFamilies:
              5,
          },

          taller: {
            totalStudents:
              8,
          },
        };

        service
          .getSummary
          .mockResolvedValue(
            expected,
          );

        await expect(
          controller.getSummary(
            query,
          ),
        ).resolves.toEqual(
          expected,
        );

        expect(
          service.getSummary,
        ).toHaveBeenCalledWith(
          query,
        );
      },
    );

    it(
      'delegates APAFA report query',
      async () => {
        const query = {
          schoolPeriodId:
            PERIOD_ID,

          status:
            'PAGADO' as const,

          search:
            'ramirez',

          page:
            1,

          limit:
            20,
        };

        const expected = {
          data: [],
          pagination: {
            total:
              0,
          },
        };

        service
          .getApafaReport
          .mockResolvedValue(
            expected,
          );

        await expect(
          controller
            .getApafaReport(
              query,
            ),
        ).resolves.toEqual(
          expected,
        );

        expect(
          service
            .getApafaReport,
        ).toHaveBeenCalledWith(
          query,
        );
      },
    );

    it(
      'delegates Taller report query',
      async () => {
        const query = {
          schoolPeriodId:
            PERIOD_ID,

          status:
            'NO_PAGADO' as const,

          page:
            1,

          limit:
            20,
        };

        const expected = {
          data: [],
          pagination: {
            total:
              0,
          },
        };

        service
          .getTallerReport
          .mockResolvedValue(
            expected,
          );

        await expect(
          controller
            .getTallerReport(
              query,
            ),
        ).resolves.toEqual(
          expected,
        );

        expect(
          service
            .getTallerReport,
        ).toHaveBeenCalledWith(
          query,
        );
      },
    );

    it(
      'sends APAFA XLSX response with download headers',
      async () => {
        const buffer =
          Buffer.from(
            'xlsx',
          );

        service
          .exportApafaXlsx
          .mockResolvedValue({
            buffer,

            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

            filename:
              'reporte-apafa-2026.xlsx',
          });

        const response = {
          setHeader:
            vi.fn(),

          end:
            vi.fn(),
        } as unknown as Response;

        await controller
          .exportApafaXlsx(
            {
              schoolPeriodId:
                PERIOD_ID,
            },
            response,
          );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="reporte-apafa-2026.xlsx"',
        );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Length',
          buffer.length,
        );

        expect(
          response.end,
        ).toHaveBeenCalledWith(
          buffer,
        );
      },
    );

    it(
      'sends APAFA PDF response with download headers',
      async () => {
        const buffer =
          Buffer.from(
            '%PDF',
          );

        service
          .exportApafaPdf
          .mockResolvedValue({
            buffer,

            contentType:
              'application/pdf',

            filename:
              'reporte-apafa-2026.pdf',
          });

        const response = {
          setHeader:
            vi.fn(),

          end:
            vi.fn(),
        } as unknown as Response;

        await controller
          .exportApafaPdf(
            {
              schoolPeriodId:
                PERIOD_ID,
            },
            response,
          );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Type',
          'application/pdf',
        );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="reporte-apafa-2026.pdf"',
        );

        expect(
          response.end,
        ).toHaveBeenCalledWith(
          buffer,
        );
      },
    );

    it(
      'sends Taller XLSX response with download headers',
      async () => {
        const buffer =
          Buffer.from(
            'xlsx',
          );

        service
          .exportTallerXlsx
          .mockResolvedValue({
            buffer,

            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

            filename:
              'reporte-taller-2026.xlsx',
          });

        const response = {
          setHeader:
            vi.fn(),

          end:
            vi.fn(),
        } as unknown as Response;

        await controller
          .exportTallerXlsx(
            {
              schoolPeriodId:
                PERIOD_ID,
            },
            response,
          );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="reporte-taller-2026.xlsx"',
        );

        expect(
          response.end,
        ).toHaveBeenCalledWith(
          buffer,
        );
      },
    );

    it(
      'sends Taller PDF response with download headers',
      async () => {
        const buffer =
          Buffer.from(
            '%PDF',
          );

        service
          .exportTallerPdf
          .mockResolvedValue({
            buffer,

            contentType:
              'application/pdf',

            filename:
              'reporte-taller-2026.pdf',
          });

        const response = {
          setHeader:
            vi.fn(),

          end:
            vi.fn(),
        } as unknown as Response;

        await controller
          .exportTallerPdf(
            {
              schoolPeriodId:
                PERIOD_ID,
            },
            response,
          );

        expect(
          response.setHeader,
        ).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="reporte-taller-2026.pdf"',
        );

        expect(
          response.end,
        ).toHaveBeenCalledWith(
          buffer,
        );
      },
    );
  },
);