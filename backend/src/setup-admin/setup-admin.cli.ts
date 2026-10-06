import 'dotenv/config';

import { HttpException } from '@nestjs/common';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { PrismaService } from '../prisma/prisma.service.js';
import { SetupAdminService, type SetupAdminInput } from './setup-admin.service.js';

function readArgument(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readEnvironment(name?: string) {
  if (!name) return undefined;

  const value = process.env[name];
  delete process.env[name];
  return value === undefined ? undefined : value.trim();
}

async function readSecret(label: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error(
      'La entrada no es interactiva. Defina SETUP_ADMIN_PASSWORD de forma segura para esta ejecución.',
    );
  }

  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };

    stdin.on('data', onData);
  });
}

async function collectInput(): Promise<SetupAdminInput> {
  const environmentByArgument: Record<string, string> = {
    'first-name': 'SETUP_ADMIN_FIRST_NAME',
    'last-name-father': 'SETUP_ADMIN_LAST_NAME_FATHER',
    'last-name-mother': 'SETUP_ADMIN_LAST_NAME_MOTHER',
    'document-type': 'SETUP_ADMIN_DOCUMENT_TYPE',
    'document-number': 'SETUP_ADMIN_DOCUMENT_NUMBER',
    email: 'SETUP_ADMIN_EMAIL',
    phone: 'SETUP_ADMIN_PHONE',
    username: 'SETUP_ADMIN_USERNAME',
  };

  const prompt = createInterface({ input: stdin, output: stdout });
  const ask = async (argument: string, label: string, optional = false) => {
    const supplied =
      readArgument(argument) ?? readEnvironment(environmentByArgument[argument]);
    if (supplied !== undefined) return supplied;
    const value = await prompt.question(`${label}: `);
    return optional ? value : value.trim();
  };

  const data = {
    firstName: await ask('first-name', 'Nombres'),
    lastNameFather: await ask('last-name-father', 'Apellido paterno'),
    lastNameMother: await ask('last-name-mother', 'Apellido materno (opcional)', true),
    documentType: await ask('document-type', 'Tipo de documento'),
    documentNumber: await ask('document-number', 'Número de documento'),
    email: await ask('email', 'Correo'),
    phone: await ask('phone', 'Teléfono (opcional)', true),
    username: await ask('username', 'Username'),
  };
  prompt.close();

  let password = readEnvironment('SETUP_ADMIN_PASSWORD');
  if (!password) {
    password = await readSecret('Contraseña: ');
    const confirmation = await readSecret('Confirmar contraseña: ');
    if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  }

  return { ...data, password };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join('. ');
    }
  }
  return error instanceof Error ? error.message : 'No se pudo crear el ADMINISTRADOR.';
}

async function main() {
  const prisma = new PrismaService();
  try {
    const input = await collectInput();
    await prisma.$connect();
    const result = await new SetupAdminService(prisma).createFirstAdministrator(input);
    console.log(`ADMINISTRADOR creado correctamente: ${result.username}`);
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

await main();
