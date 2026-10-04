import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

function transformBoolean(
  value: unknown,
): unknown {
  if (
    typeof value ===
    'boolean'
  ) {
    return value;
  }

  if (
    typeof value ===
    'string'
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized ===
      'true'
    ) {
      return true;
    }

    if (
      normalized ===
      'false'
    ) {
      return false;
    }
  }

  return value;
}

function transformStudentIds(
  value: unknown,
): unknown {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    typeof value !==
    'string'
  ) {
    return value;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return [];
  }

  try {
    const parsed:
      unknown =
      JSON.parse(
        normalized,
      );

    return Array.isArray(
      parsed,
    )
      ? parsed
      : [
          normalized,
        ];
  } catch {
    return [
      normalized,
    ];
  }
}

export class CreatePaymentDto {
  @IsUUID('4')
  schoolPeriodId!: string;

  @IsUUID('4')
  familyGroupId!: string;

  @IsDateString({
    strict: true,
  })
  paymentDate!: string;

  @Transform(
    ({ value }) =>
      transformBoolean(
        value,
      ),
  )
  @IsBoolean()
  includeApafa!: boolean;

  @Transform(
    ({ value }) =>
      transformStudentIds(
        value,
      ),
  )
  @IsArray()
  @IsUUID('4', {
    each: true,
  })
  studentIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  operationNumber?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  voucherAssociations?:
    unknown;
}