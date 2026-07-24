import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { CustomLoggerService } from '../../modules/logger/custom-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    constructor(private readonly logger: CustomLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

      const logMessage = {
        method: request.method,
        url: request.url,
        body: request.body,
        query: request.query,
        params: request.params,
        httpStatus,
        message: JSON.stringify(message),
      };
    const user = (request as any).user?.email ?? (request as any).user?.id ?? 'anonymous';
    const stack = exception instanceof Error ? exception.stack : undefined;      

    // const responseBody = {
    //   statusCode: httpStatus,
    //   timestamp: new Date().toISOString(),
    //   path: httpAdapter.getRequestUrl(ctx.getRequest()),
    //   message:
    //     exception instanceof HttpException
    //       ? exception.message
    //       : 'Internal server error',
    // };

    //this.logger.error(`HTTP Status: ${status} Error Message: ${JSON.stringify(message)}`, JSON.stringify(logMessage));
    //httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);

    this.logger.error(
      `[${request.method}] ${request.url} - ${httpStatus} - user=${user} - ${JSON.stringify(message)}`,
      stack ?? 'ExceptionFilter',
    );

    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: typeof message === 'object' && message !== null && 'message' in message
        ? (Array.isArray((message as any).message)
          ? (message as any).message[0]
          : (message as any).message)
        : message || 'Something went wrong',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}