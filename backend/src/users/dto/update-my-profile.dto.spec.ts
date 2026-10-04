import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { UpdateMyProfileDto } from './update-my-profile.dto.js';

describe('UpdateMyProfileDto', () => {
  it.each(['M', 'F', 'NO_ESPECIFICA', '', null])('accepts controlled profile gender %s', async (gender) => {
    const dto = Object.assign(new UpdateMyProfileDto(), { gender });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an arbitrary gender', async () => {
    const dto = Object.assign(new UpdateMyProfileDto(), { gender: 'OTRO' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('accepts a document correction', async () => {
    const dto = Object.assign(new UpdateMyProfileDto(), { documentType: 'DNI', documentNumber: '12345678' });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['roleId', 'personId', 'userId', 'username', 'isActive'])('rejects protected field %s with the global validation policy', async (field) => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ phone: '999', [field]: 'forbidden' }, {
      type: 'body', metatype: UpdateMyProfileDto, data: '',
    })).rejects.toThrow();
  });
});
