import { HttpException } from '@nestjs/common';

/**
 * Exception untuk response level "warning".
 * Status HTTP tetap 2xx (default 200) sehingga tidak dianggap gagal oleh client.
 */
export class WarningException extends HttpException {
  constructor(message: string, data?: unknown, statusCode = 200) {
    super({ message, data }, statusCode);
  }
}
