import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as os from 'os';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;

    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    instrument: ObserveInstrument,
  });

  const port = parseInt(process.env.PORT ?? '32310');

  await app.listen(port, '0.0.0.0');

  const address = app.getHttpServer().address() as
    | { port?: number }
    | string
    | null;
  const activePort =
    typeof address === 'object' && address !== null && address.port
      ? address.port
      : port;

  const localIp = getLocalIp();
  console.log(`Application is running on: http://localhost:${activePort}`);
  console.log(`Network: http://${localIp}:${activePort}`);
}
void bootstrap();