import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
} from '@prisma/client';

import {
  access,
  unlink,
} from 'node:fs/promises';

import {
  constants,
} from 'node:fs';

import {
  relative,
  resolve,
} from 'node:path';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  UpdateVoucherLinksDto,
} from './dto/update-voucher-links.dto.js';

export type VoucherFileMode =
  | 'view'
  | 'download';

export interface VoucherFileResult {
  absolutePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number | null;
  disposition:
    | 'inline'
    | 'attachment';
}

export interface VoucherAuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

export interface DeletedVoucherResult {
  paymentId: string;
  voucherId: string;
  revertedApafa: boolean;
  revertedStudentIds: string[];
}

export interface UpdatedVoucherLinksResult {
  voucherId: string;
  paymentId: string;
  includeApafa: boolean;
  students: Array<{
    studentId: string;
    studentName: string;
  }>;
  revertedApafa: boolean;
  revertedStudentIds: string[];
}

const PREVIEWABLE_MIME_TYPES =
  new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

const MAX_TRANSACTION_RETRIES = 3;

@Injectable()
export class PaymentVouchersService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  // ============================================================
  // OBTENER ARCHIVO
  // ============================================================

  async getVoucherFile(
    paymentId: string,
    voucherId: string,
    mode: VoucherFileMode,
  ): Promise<VoucherFileResult> {
    const voucher =
      await this.prisma
        .vouchers
        .findFirst({
          where: {
            id: voucherId,
            payment_id:
              paymentId,
          },

          select: {
            id: true,
            original_name:
              true,
            file_path:
              true,
            mime_type:
              true,
            file_size:
              true,
          },
        });

    if (!voucher) {
      throw new NotFoundException(
        'El voucher no existe o no pertenece al pago indicado',
      );
    }

    const mimeType =
      voucher.mime_type ??
      'application/octet-stream';

    if (
      mode === 'view' &&
      !PREVIEWABLE_MIME_TYPES.has(
        mimeType,
      )
    ) {
      throw new BadRequestException(
        'Este tipo de archivo no admite vista previa',
      );
    }

    const absolutePath =
      this.resolveVoucherStoragePath(
        voucher.file_path,
      );

    try {
      await access(
        absolutePath,
        constants.R_OK,
      );
    } catch {
      throw new NotFoundException(
        'El archivo físico del voucher no está disponible',
      );
    }

    return {
      absolutePath,

      originalName:
        voucher.original_name,

      mimeType,

      fileSize:
        voucher.file_size ===
        null
          ? null
          : Number(
              voucher.file_size,
            ),

      disposition:
        mode === 'view'
          ? 'inline'
          : 'attachment',
    };
  }

  // ============================================================
  // CONSULTAR ASOCIACIONES
  // ============================================================

  async getVoucherLinks(
    paymentId: string,
    voucherId: string,
  ) {
    const voucher =
      await this.prisma
        .vouchers
        .findFirst({
          where: {
            id: voucherId,
            payment_id:
              paymentId,
          },

          include: {
            voucher_family_items:
              {
                include: {
                  payment_family_items:
                    true,
                },
              },

            voucher_student_items:
              {
                include: {
                  payment_student_items:
                    {
                      include: {
                        students: {
                          include: {
                            persons:
                              true,
                          },
                        },
                      },
                    },
                },
              },
          },
        });

    if (!voucher) {
      throw new NotFoundException(
        'El voucher no existe o no pertenece al pago indicado',
      );
    }

    return {
      voucherId:
        voucher.id,

      paymentId:
        voucher.payment_id,

      includeApafa:
        voucher
          .voucher_family_items
          .length > 0,

      students:
        voucher
          .voucher_student_items
          .map(
            (link) => {
              const item =
                link
                  .payment_student_items;

              return {
                studentId:
                  item.student_id,

                studentName:
                  this.buildFullName({
                    firstName:
                      item.students
                        .persons
                        .first_name,

                    lastNameFather:
                      item.students
                        .persons
                        .last_name_father,

                    lastNameMother:
                      item.students
                        .persons
                        .last_name_mother,
                  }),
              };
            },
          ),
    };
  }

  // ============================================================
  // ACTUALIZAR ASOCIACIONES
  // ============================================================

  async updateVoucherLinks(
    paymentId: string,
    voucherId: string,
    dto: UpdateVoucherLinksDto,
    auditContext:
      VoucherAuditContext,
  ): Promise<UpdatedVoucherLinksResult> {
    const includeApafa =
      dto.includeApafa ??
      false;

    const studentIds =
      [
        ...new Set(
          dto.studentIds ??
            [],
        ),
      ];

    if (!includeApafa && studentIds.length === 0) {
      throw new BadRequestException('Todo voucher debe estar asociado al menos a un concepto. Elimine el voucher si ya no corresponde.');
    }

    const correctionResult =
      await this.executeSerializable(
        async (
          transaction,
        ) => {
          const voucher =
            await transaction
              .vouchers
              .findFirst({
                where: {
                  id: voucherId,
                  payment_id:
                    paymentId,
                },

                include: {
                  voucher_family_items:
                    true,

                  voucher_student_items:
                    {
                      include: {
                        payment_student_items:
                          true,
                      },
                    },
                },
              });

          if (!voucher) {
            throw new NotFoundException(
              'El voucher no existe o no pertenece al pago indicado',
            );
          }

          const payment =
            await transaction
              .payments
              .findUnique({
                where: {
                  id:
                    paymentId,
                },

                include: {
                  family_items:
                    true,

                  student_items:
                    {
                      include: {
                        students: {
                          include: {
                            persons:
                              true,
                          },
                        },
                      },
                    },
                },
              });

          if (!payment) {
            throw new NotFoundException(
              'El pago no existe',
            );
          }

          const familyItem =
            payment
              .family_items[0] ??
            null;

          if (
            includeApafa &&
            !familyItem
          ) {
            throw new BadRequestException(
              'El pago indicado no contiene APAFA',
            );
          }

          const studentItemsByStudentId =
            new Map(
              payment
                .student_items
                .map(
                  (item) => [
                    item.student_id,
                    item,
                  ],
                ),
            );

          for (
            const studentId
            of studentIds
          ) {
            if (
              !studentItemsByStudentId
                .has(
                  studentId,
                )
            ) {
              throw new BadRequestException(
                `El Taller del estudiante ${studentId} no pertenece al pago indicado`,
              );
            }
          }

          const oldFamilyItemIds =
            voucher
              .voucher_family_items
              .map(
                (link) =>
                  link
                    .payment_family_item_id,
              );

          const oldStudentLinks =
            voucher
              .voucher_student_items
              .map(
                (link) => ({
                  itemId:
                    link
                      .payment_student_item_id,

                  studentId:
                    link
                      .payment_student_items
                      .student_id,
                }),
              );

          const oldValue = {
            includeApafa:
              oldFamilyItemIds
                .length > 0,

            studentIds:
              oldStudentLinks
                .map(
                  (link) =>
                    link.studentId,
                ),
          };

          const desiredFamilyItemId =
            includeApafa &&
            familyItem
              ? familyItem.id
              : null;

          const desiredStudentItemIds =
            new Set(
              studentIds
                .map(
                  (
                    studentId,
                  ) =>
                    studentItemsByStudentId
                      .get(
                        studentId,
                      )
                      ?.id,
                )
                .filter(
                  (
                    itemId,
                  ): itemId is string =>
                    typeof itemId ===
                    'string',
                ),
            );

          if (desiredFamilyItemId) {
            const linkedElsewhere = await transaction.voucher_family_items.count({
              where: { payment_family_item_id: desiredFamilyItemId, voucher_id: { not: voucherId } },
            });
            if (linkedElsewhere > 0) throw new ConflictException('APAFA ya está asociado a otro voucher');
          }
          for (const itemId of desiredStudentItemIds) {
            const linkedElsewhere = await transaction.voucher_student_items.count({
              where: { payment_student_item_id: itemId, voucher_id: { not: voucherId } },
            });
            if (linkedElsewhere > 0) throw new ConflictException('El Taller del estudiante ya está asociado a otro voucher');
          }

          const removedFamilyItemIds =
            oldFamilyItemIds
              .filter(
                (itemId) =>
                  itemId !==
                  desiredFamilyItemId,
              );

          const removedStudentLinks =
            oldStudentLinks
              .filter(
                (link) =>
                  !desiredStudentItemIds
                    .has(
                      link.itemId,
                    ),
              );

          const familyItemsToRevert:
            string[] = [];

          const studentItemsToRevert:
            string[] = [];

          const revertedStudentIds:
            string[] = [];

          for (
            const familyItemId
            of removedFamilyItemIds
          ) {
            const otherVoucherLinks =
              await transaction
                .voucher_family_items
                .count({
                  where: {
                    payment_family_item_id:
                      familyItemId,

                    voucher_id: {
                      not:
                        voucherId,
                    },
                  },
                });

            if (
              otherVoucherLinks ===
              0
            ) {
              familyItemsToRevert
                .push(
                  familyItemId,
                );
            }
          }

          for (
            const link
            of removedStudentLinks
          ) {
            const otherVoucherLinks =
              await transaction
                .voucher_student_items
                .count({
                  where: {
                    payment_student_item_id:
                      link.itemId,

                    voucher_id: {
                      not:
                        voucherId,
                    },
                  },
                });

            if (
              otherVoucherLinks ===
              0
            ) {
              studentItemsToRevert
                .push(
                  link.itemId,
                );

              revertedStudentIds
                .push(
                  link.studentId,
                );
            }
          }

          await transaction
            .voucher_family_items
            .deleteMany({
              where: {
                voucher_id:
                  voucherId,
              },
            });

          await transaction
            .voucher_student_items
            .deleteMany({
              where: {
                voucher_id:
                  voucherId,
              },
            });

          if (
            familyItemsToRevert
              .length > 0
          ) {
            await transaction
              .payment_family_items
              .deleteMany({
                where: {
                  payment_id:
                    paymentId,

                  id: {
                    in:
                      familyItemsToRevert,
                  },
                },
              });
          }

          if (
            studentItemsToRevert
              .length > 0
          ) {
            await transaction
              .payment_student_items
              .deleteMany({
                where: {
                  payment_id:
                    paymentId,

                  id: {
                    in:
                      studentItemsToRevert,
                  },
                },
              });
          }

          /*
           * Después de revertir asociaciones eliminadas,
           * solo podemos crear vínculos hacia items que
           * continúan existiendo.
           */

          if (
            includeApafa &&
            familyItem &&
            !familyItemsToRevert
              .includes(
                familyItem.id,
              )
          ) {
            await transaction
              .voucher_family_items
              .create({
                data: {
                  voucher_id:
                    voucherId,

                  payment_id:
                    paymentId,

                  payment_family_item_id:
                    familyItem.id,
                },
              });
          }

          const studentLinksToCreate =
            studentIds
              .map(
                (
                  studentId,
                ) => {
                  const item =
                    studentItemsByStudentId
                      .get(
                        studentId,
                      );

                  if (
                    !item ||
                    studentItemsToRevert
                      .includes(
                        item.id,
                      )
                  ) {
                    return null;
                  }

                  return {
                    voucher_id:
                      voucherId,

                    payment_id:
                      paymentId,

                    payment_student_item_id:
                      item.id,
                  };
                },
              )
              .filter(
                (
                  item,
                ): item is {
                  voucher_id: string;
                  payment_id: string;
                  payment_student_item_id: string;
                } =>
                  item !== null,
              );

          if (
            studentLinksToCreate
              .length > 0
          ) {
            await transaction
              .voucher_student_items
              .createMany({
                data:
                  studentLinksToCreate,
              });
          }

          const newValue = {
            includeApafa,
            studentIds,
          };

          await transaction
            .audit_logs
            .create({
              data: {
                user_id:
                  auditContext
                    .userId,

                entity_name:
                  'vouchers',

                entity_id:
                  voucherId,

                action:
                  'UPDATE_LINKS',

                old_value:
                  oldValue,

                new_value: {
                  ...newValue,

                  revertedApafa:
                    familyItemsToRevert
                      .length > 0,

                  revertedStudentIds,
                },

                ip_address:
                  auditContext
                    .ipAddress,

                device_name:
                  auditContext
                    .deviceName,
              },
            });

          return {
            revertedApafa:
              familyItemsToRevert
                .length > 0,

            revertedStudentIds,
          };
        },
      );

    /*
     * La actualización pudo haber eliminado
     * payment items. Consultamos nuevamente
     * las asociaciones efectivamente persistidas.
     */
    const links =
      await this.getVoucherLinks(
        paymentId,
        voucherId,
      );

    return {
      ...links,

      revertedApafa:
        correctionResult
          .revertedApafa,

      revertedStudentIds:
        correctionResult
          .revertedStudentIds,
    };
  }

  // ============================================================
  // ELIMINAR VOUCHER
  // ============================================================

  async deleteVoucher(
    paymentId: string,
    voucherId: string,
    auditContext:
      VoucherAuditContext,
  ): Promise<DeletedVoucherResult> {
    /*
     * Solo obtenemos metadata antes de la transacción.
     * No exigimos que el archivo físico exista.
     */
    const voucherBeforeDelete =
      await this.prisma
        .vouchers
        .findFirst({
          where: {
            id: voucherId,
            payment_id:
              paymentId,
          },

          select: {
            id: true,
            payment_id:
              true,
            original_name:
              true,
            physical_name:
              true,
            file_path:
              true,
            mime_type:
              true,
            file_size:
              true,
            file_hash:
              true,
            uploaded_at:
              true,
          },
        });

    if (
      !voucherBeforeDelete
    ) {
      throw new NotFoundException(
        'El voucher no existe o no pertenece al pago indicado',
      );
    }

    /*
     * Resolvemos el path de forma segura,
     * pero NO comprobamos existencia física.
     */
    const absolutePath =
      this.resolveVoucherStoragePath(
        voucherBeforeDelete
          .file_path,
      );

    const result =
      await this.executeSerializable(
        async (
          transaction,
        ): Promise<DeletedVoucherResult> => {
          const voucher =
            await transaction
              .vouchers
              .findFirst({
                where: {
                  id:
                    voucherId,

                  payment_id:
                    paymentId,
                },

                include: {
                  voucher_family_items:
                    true,

                  voucher_student_items:
                    {
                      include: {
                        payment_student_items:
                          true,
                      },
                    },
                },
              });

          if (!voucher) {
            throw new NotFoundException(
              'El voucher no existe o no pertenece al pago indicado',
            );
          }

          const familyItemIds =
            voucher
              .voucher_family_items
              .map(
                (
                  link,
                ) =>
                  link
                    .payment_family_item_id,
              );

          const studentLinks =
            voucher
              .voucher_student_items
              .map(
                (
                  link,
                ) => ({
                  itemId:
                    link
                      .payment_student_item_id,

                  studentId:
                    link
                      .payment_student_items
                      .student_id,
                }),
              );

          const familyItemsToRevert:
            string[] = [];

          const studentItemsToRevert:
            string[] = [];

          const revertedStudentIds:
            string[] = [];

          /*
           * Un voucher sin asociaciones específicas
           * es evidencia general.
           *
           * En ese caso estas colecciones estarán
           * vacías y ningún concepto se modifica.
           */

          for (
            const familyItemId
            of familyItemIds
          ) {
            const otherVoucherLinks =
              await transaction
                .voucher_family_items
                .count({
                  where: {
                    payment_family_item_id:
                      familyItemId,

                    voucher_id: {
                      not:
                        voucherId,
                    },
                  },
                });

            if (
              otherVoucherLinks ===
              0
            ) {
              familyItemsToRevert
                .push(
                  familyItemId,
                );
            }
          }

          for (
            const link
            of studentLinks
          ) {
            const otherVoucherLinks =
              await transaction
                .voucher_student_items
                .count({
                  where: {
                    payment_student_item_id:
                      link.itemId,

                    voucher_id: {
                      not:
                        voucherId,
                    },
                  },
                });

            if (
              otherVoucherLinks ===
              0
            ) {
              studentItemsToRevert
                .push(
                  link.itemId,
                );

              revertedStudentIds
                .push(
                  link.studentId,
                );
            }
          }

          /*
           * Primero eliminamos relaciones.
           * Las FK son NO ACTION intencionalmente.
           */

          await transaction
            .voucher_family_items
            .deleteMany({
              where: {
                voucher_id:
                  voucherId,
              },
            });

          await transaction
            .voucher_student_items
            .deleteMany({
              where: {
                voucher_id:
                  voucherId,
              },
            });

          /*
           * Si un concepto perdió su última
           * evidencia específica, desaparece
           * el payment item y vuelve a NO PAGADO.
           */

          if (
            familyItemsToRevert
              .length > 0
          ) {
            await transaction
              .payment_family_items
              .deleteMany({
                where: {
                  payment_id:
                    paymentId,

                  id: {
                    in:
                      familyItemsToRevert,
                  },
                },
              });
          }

          if (
            studentItemsToRevert
              .length > 0
          ) {
            await transaction
              .payment_student_items
              .deleteMany({
                where: {
                  payment_id:
                    paymentId,

                  id: {
                    in:
                      studentItemsToRevert,
                  },
                },
              });
          }

          await transaction
            .vouchers
            .delete({
              where: {
                id:
                  voucherId,
              },
            });

          /*
           * Mantenemos payments aunque quede sin
           * items/vouchers. Es la cabecera histórica
           * de una operación corregida.
           *
           * No inventamos por ahora CANCELLED.
           */

          await transaction
            .audit_logs
            .create({
              data: {
                user_id:
                  auditContext
                    .userId,

                entity_name:
                  'vouchers',

                entity_id:
                  voucherId,

                action:
                  'DELETE',

                old_value: {
                  paymentId,

                  originalName:
                    voucherBeforeDelete
                      .original_name,

                  mimeType:
                    voucherBeforeDelete
                      .mime_type,

                  fileSize:
                    voucherBeforeDelete
                      .file_size ===
                    null
                      ? null
                      : Number(
                          voucherBeforeDelete
                            .file_size,
                        ),

                  fileHash:
                    voucherBeforeDelete
                      .file_hash,

                  uploadedAt:
                    voucherBeforeDelete
                      .uploaded_at
                      .toISOString(),

                  associatedApafa:
                    familyItemIds
                      .length > 0,

                  associatedStudentIds:
                    studentLinks
                      .map(
                        (
                          link,
                        ) =>
                          link
                            .studentId,
                      ),
                },

                new_value: {
                  deleted:
                    true,

                  revertedApafa:
                    familyItemsToRevert
                      .length > 0,

                  revertedStudentIds,
                },

                ip_address:
                  auditContext
                    .ipAddress,

                device_name:
                  auditContext
                    .deviceName,
              },
            });

          return {
            paymentId,
            voucherId,

            revertedApafa:
              familyItemsToRevert
                .length > 0,

            revertedStudentIds,
          };
        },
      );

    /*
     * La transacción ya terminó correctamente.
     *
     * La eliminación física no forma parte
     * de la transacción PostgreSQL.
     *
     * Si falla, la información financiera
     * NO debe restaurarse.
     */
    try {
      await unlink(
        absolutePath,
      );
    } catch (error) {
      const nodeError =
        error as NodeJS.ErrnoException;

      /*
       * ENOENT significa que el archivo ya
       * no estaba presente. La corrección
       * sigue siendo válida.
       */
      if (
        nodeError.code !==
        'ENOENT'
      ) {
        console.error(
          `No fue posible eliminar físicamente el voucher ${voucherId}`,
          error,
        );
      }
    }

    return result;
  }

  // ============================================================
  // PATH SEGURO DE VOUCHERS
  // ============================================================

  private resolveVoucherStoragePath(
    storedPath: string,
  ): string {
    const storageRoot =
      resolve(
        process.env
          .VOUCHER_STORAGE_PATH ??
          resolve(
            process.cwd(),
            'storage',
            'vouchers',
          ),
      );

    const absolutePath =
      resolve(
        process.cwd(),
        storedPath,
      );

    const relativePath =
      relative(
        storageRoot,
        absolutePath,
      );

    /*
     * Impide:
     *
     * ../
     * ..\
     * rutas absolutas fuera del storage
     */

    if (
      relativePath ===
        '..' ||
      relativePath.startsWith(
        `..\\`,
      ) ||
      relativePath.startsWith(
        '../',
      ) ||
      resolve(
        storageRoot,
        relativePath,
      ) !==
        absolutePath
    ) {
      throw new NotFoundException(
        'El archivo físico del voucher no está disponible',
      );
    }

    return absolutePath;
  }

  // ============================================================
  // TRANSACCIÓN SERIALIZABLE
  // ============================================================

  private async executeSerializable<T>(
    operation: (
      transaction:
        Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    let lastError:
      unknown = null;

    for (
      let attempt = 1;
      attempt <=
      MAX_TRANSACTION_RETRIES;
      attempt++
    ) {
      try {
        return await this
          .prisma
          .$transaction(
            operation,
            {
              isolationLevel:
                Prisma
                  .TransactionIsolationLevel
                  .Serializable,

              maxWait:
                5000,

              timeout:
                15000,
            },
          );
      } catch (error) {
        lastError =
          error;

        const isRetryable =
          error instanceof
            Prisma
              .PrismaClientKnownRequestError &&
          error.code ===
            'P2034';

        if (
          !isRetryable ||
          attempt ===
            MAX_TRANSACTION_RETRIES
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private buildFullName(
    data: {
      firstName: string;
      lastNameFather:
        string | null;
      lastNameMother:
        string | null;
    },
  ): string {
    return [
      data.firstName,
      data.lastNameFather,
      data.lastNameMother,
    ]
      .filter(
        (
          value,
        ): value is string =>
          typeof value ===
            'string' &&
          value
            .trim()
            .length > 0,
      )
      .join(' ')
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
}
