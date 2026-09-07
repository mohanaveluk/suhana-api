import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecentVisitResponseDto {
  @ApiProperty({ example: 'a3f1c2d4-...' }) profileId: string;
  @ApiPropertyOptional({ example: 'SP100' }) profileCode: string | null;
  @ApiProperty({ example: 'Priya' }) firstName: string;
  @ApiPropertyOptional({ example: 'Sharma' }) lastName: string | null;
  @ApiProperty({ example: 'Priya Sharma', description: 'Convenience full name' }) name: string;
  @ApiPropertyOptional({ example: 27 }) age: number | null;
  @ApiPropertyOptional({ example: 'Dallas' }) city: string | null;
  @ApiPropertyOptional({ example: 'Texas' }) state: string | null;
  @ApiPropertyOptional({ enum: ['bride', 'groom'] }) gender: string | null;
  @ApiPropertyOptional({ example: 'https://.../priya.jpg', description: 'Primary active photo, or null' })
  photoUrl: string | null;

  @ApiProperty({ example: 4 }) visitCount: number;
  @ApiProperty({ example: '2026-09-07T12:30:00.000Z' }) lastVisitedAt: Date;
  @ApiProperty({ example: '2026-09-01T09:10:00.000Z' }) firstVisitedAt: Date;

  @ApiPropertyOptional({
    example: 'interested',
    description:
      'Status of any existing match row from the visitor to this profile ' +
      '(suggested | shortlisted | interested | connected | skipped | reconsidered), or null.',
  })
  matchStatus: string | null;
}

export class PaginatedRecentVisitsResponseDto {
  @ApiProperty({ type: [RecentVisitResponseDto] }) data: RecentVisitResponseDto[];
  @ApiProperty({ example: 45 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 3 }) totalPages: number;
}
