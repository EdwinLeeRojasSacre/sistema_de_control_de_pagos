import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FilesInterceptor,
} from '@nestjs/platform-express';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  createReadStream,
} from 'node:fs';

import type {
  Request,
  Response,
} from 'express';

import {
  Roles,
} from '../auth/roles.decorator.js';

import {
  RolesGuard,
} from '../auth/roles.guard.js';

import {
  CreatePaymentDto,
} from './dto/create-payment.dto.js';

import {
  FindPaymentsQueryDto,
} from './dto/find-payments-query.dto.js';

import {
  UpdateVoucherLinksDto,
} from './dto/update-voucher-links.dto.js';

import {
  VoucherFileQueryDto,
} from './dto/voucher-file-query.dto.js';

import {
  PaymentVouchersService,
} from './payment-vouchers.service.js';

import {
  PaymentsService,
  type UploadedVoucherFile,
} from './payments.service.js';

interface AuthenticatedRequest
  extends Request {
  user: {
    sub: string;
    username: string;
    role: string;
  };
}

@Controller('payments')
@UseGuards(
  AuthGuard('jwt'),
  RolesGuard,
)
export class PaymentsController {
  constructor(
    private readonly paymentsService:
      PaymentsService,

    private readonly paymentVouchersService:
      PaymentVouchersService,
  ) {}

  // ============================================================
  // LISTADO
  // ============================================================

  @Get()
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findAll(
    @Query()
    query:
      FindPaymentsQueryDto,
  ) {
    return this
      .paymentsService
      .findAll(
        query,
      );
  }

  // ============================================================
  // ESTADO DE PAGOS DE FAMILIA
  // ============================================================

  @Get('family-status')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async getFamilyPaymentStatus(
    @Query(
      'familyGroupId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    familyGroupId: string,

    @Query(
      'schoolPeriodId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    schoolPeriodId: string,
  ) {
    return this
      .paymentsService
      .getFamilyPaymentStatus(
        familyGroupId,
        schoolPeriodId,
      );
  }

  // ============================================================
  // ARCHIVO DE VOUCHER
  // ============================================================

  @Get(
    ':paymentId/vouchers/:voucherId/file',
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async getVoucherFile(
    @Param(
      'paymentId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    paymentId: string,

    @Param(
      'voucherId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    voucherId: string,

    @Query()
    query:
      VoucherFileQueryDto,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<StreamableFile> {
    const result =
      await this
        .paymentVouchersService
        .getVoucherFile(
          paymentId,
          voucherId,
          query.mode ??
            'download',
        );

    response.setHeader(
      'Content-Type',
      result.mimeType,
    );

    response.setHeader(
      'Content-Disposition',
      this.buildContentDisposition(
        result.disposition,
        result.originalName,
      ),
    );

    response.setHeader(
      'X-Content-Type-Options',
      'nosniff',
    );

    response.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    if (
      result.fileSize !==
      null
    ) {
      response.setHeader(
        'Content-Length',
        String(
          result.fileSize,
        ),
      );
    }

    return new StreamableFile(
      createReadStream(
        result.absolutePath,
      ),
    );
  }

  // ============================================================
  // ASOCIACIONES DEL VOUCHER
  // ============================================================

  @Get(
    ':paymentId/vouchers/:voucherId/links',
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async getVoucherLinks(
    @Param(
      'paymentId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    paymentId: string,

    @Param(
      'voucherId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    voucherId: string,
  ) {
    return this
      .paymentVouchersService
      .getVoucherLinks(
        paymentId,
        voucherId,
      );
  }

  @Patch(
    ':paymentId/vouchers/:voucherId/links',
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async updateVoucherLinks(
    @Param(
      'paymentId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    paymentId: string,

    @Param(
      'voucherId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    voucherId: string,

    @Body()
    dto:
      UpdateVoucherLinksDto,

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this
      .paymentVouchersService
      .updateVoucherLinks(
        paymentId,
        voucherId,
        dto,
        this.buildAuditContext(
          request,
        ),
      );
  }

  // ============================================================
  // ELIMINAR VOUCHER
  // ============================================================

  @Delete(
    ':paymentId/vouchers/:voucherId',
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async deleteVoucher(
    @Param(
      'paymentId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    paymentId: string,

    @Param(
      'voucherId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    voucherId: string,

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this
      .paymentVouchersService
      .deleteVoucher(
        paymentId,
        voucherId,
        this.buildAuditContext(
          request,
        ),
      );
  }

  // ============================================================
  // DETALLE DEL PAGO
  // ============================================================

  @Get(':id')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findById(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
  ) {
    return this
      .paymentsService
      .findById(
        id,
      );
  }

  // ============================================================
  // REGISTRAR PAGO
  // ============================================================

  @Post()
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  @UseInterceptors(
    FilesInterceptor(
      'vouchers',
      10,
      {
        limits: {
          fileSize:
            10 *
            1024 *
            1024,
        },
      },
    ),
  )
  async create(
    @Body()
    dto:
      CreatePaymentDto,

    @UploadedFiles()
    voucherFiles:
      UploadedVoucherFile[],

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    if (
      typeof dto.voucherAssociations ===
      'string'
    ) {
      try {
        dto.voucherAssociations =
          JSON.parse(
            dto.voucherAssociations,
          );
      } catch {
        /*
        * Lo dejamos sin modificar.
        * PaymentsService validará el
        * formato y devolverá el 400
        * correspondiente.
        */
      }
    }

    return this
      .paymentsService
      .create(
        dto,
        voucherFiles ??
          [],
        this.buildAuditContext(
          request,
        ),
      );
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private buildAuditContext(
    request:
      AuthenticatedRequest,
  ) {
    return {
      userId:
        request.user.sub,

      ipAddress:
        request.ip ??
        null,

      deviceName:
        request.get(
          'user-agent',
        ) ??
        null,
    };
  }

  private buildContentDisposition(
    disposition:
      | 'inline'
      | 'attachment',
    originalName: string,
  ): string {
    const safeFilename =
      originalName
        .replace(
          /[\r\n"]/g,
          '_',
        )
        .trim() ||
      'voucher';

    const encodedFilename =
      encodeURIComponent(
        safeFilename,
      );

    return `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
  }
}
