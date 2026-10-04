import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { NewUserPersonDto } from './new-user-person.dto.js';
import { UpdateUserPersonDto } from './update-user.dto.js';

describe('user person gender validation', () => {
  it.each(['M', 'F', 'NO_ESPECIFICA', '', undefined])('accepts controlled or unregistered gender %s', async (gender) => {
    const dto = plainToInstance(UpdateUserPersonDto, { gender });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts null when editing to preserve the nullable contract', async () => {
    const dto = plainToInstance(UpdateUserPersonDto, { gender: null });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an arbitrary gender value', async () => {
    const dto = plainToInstance(NewUserPersonDto, {
      documentType: 'DNI', documentNumber: '12345678', firstName: 'Ana', gender: 'ARBITRARIO',
    });
    expect(await validate(dto)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'gender' }),
    ]));
  });
});
