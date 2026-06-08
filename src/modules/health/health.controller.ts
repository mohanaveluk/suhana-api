import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — is the server running?' })
  @ApiResponse({ status: 200, description: 'Server is up' })
  liveness() {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('details')
  @ApiOperation({ summary: 'Readiness probe — database + memory + uptime' })
  @ApiResponse({ status: 200, description: 'Detailed health report' })
  async readiness() {
    const [dbCheck, memory, uptimeSeconds] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(process.memoryUsage()),
      Promise.resolve(Math.floor(process.uptime())),
    ]);

    const overall = dbCheck.status === 'up' ? 'up' : 'degraded';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      uptime: {
        seconds: uptimeSeconds,
        human: this.formatUptime(uptimeSeconds),
      },
      checks: {
        database: dbCheck,
        memory: {
          status: 'up',
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
          rssMb: Math.round(memory.rss / 1024 / 1024),
          externalMb: Math.round(memory.external / 1024 / 1024),
        },
      },
    };
  }

  private async checkDatabase(): Promise<{ status: string; responseTimeMs?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      return { status: 'up', responseTimeMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', error: err.message };
    }
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
  }
}
