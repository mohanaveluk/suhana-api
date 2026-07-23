import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditRepository } from './modules/audit/audit.repository';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { waitForDatabase } from './shared/utils/database.util';
import { getDatabaseConfig } from './config/configuration';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path/win32';
require('dotenv').config();

// Last-resort crash logging. Deliberately uses console.error (synchronous, stderr) rather
// than the winston/DB-backed CustomLoggerService — if the process is crashing, we can't
// assume the DB connection or async transports are still healthy enough to log through.
// stderr is always captured by Cloud Run's Cloud Logging regardless of app state.
process.on('uncaughtException', (error) => {
  console.error(`[FATAL] Uncaught exception at ${new Date().toISOString()}:`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[FATAL] Unhandled rejection at ${new Date().toISOString()}:`, reason);
  process.exit(1);
});

async function bootstrap() {
      // Wait for database to be available
  await waitForDatabase(getDatabaseConfig());

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve everything under /src/assets as /static
  app.useStaticAssets(join(__dirname, '..', 'src', 'assets'), {
    prefix: '/static',
  });

  const server = app.getHttpServer() as http.Server;
  // Set global prefix for all routes
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  // AllExceptionsFilter and LoggingInterceptor are registered as APP_FILTER/APP_INTERCEPTOR
  // providers in AppModule (not here) so Nest's DI can inject CustomLoggerService into them.
  //app.useGlobalInterceptors(new AuditInterceptor(app.get(AuditRepository), app.get('ClinicContext')));


  // Configure CORS
  app.enableCors({
    origin: true, // This allows requests from any origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });


  //app.useGlobalGuards(new JwtAuthGuard(app.get(JwtService), app.get(Reflector)));
  //app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  // cors
  //app.enableCors(corsConfig); //CorsUtil()

  
  // Set the timeout value for sockets (in milliseconds)
  server.setTimeout(120000); // 120 seconds

  // Set the keep-alive timeout (in milliseconds)
  server.keepAliveTimeout = 30000; // 30 seconds

  // Set the headers timeout (in milliseconds)
  server.headersTimeout = 31000; // 31 seconds

  // Only enable Swagger in development mode
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
    const config = new DocumentBuilder()
      .setTitle('Authentication API')
      .setDescription('API documentation for authentication and contact endpoints')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'JWT-auth'
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }
  

  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
