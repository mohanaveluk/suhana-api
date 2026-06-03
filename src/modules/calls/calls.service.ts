import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call } from './entity/call.entity';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call) private readonly callRepo: Repository<Call>,
  ) {}

  async initiate(userId: string, conversationId: string, type: 'audio' | 'video') {
    const call = this.callRepo.create({
      conversationId,
      initiatedBy: userId,
      type,
      status: 'initiated',
    });
    return this.callRepo.save(call);
  }

  async getHistory(userId: string, conversationId?: string) {
    const qb = this.callRepo
      .createQueryBuilder('c')
      .leftJoin('c.conversation', 'conv')
      .where('(conv.participantOneId = :userId OR conv.participantTwoId = :userId)', { userId })
      .orderBy('c.startedAt', 'DESC');

    if (conversationId) {
      qb.andWhere('c.conversationId = :conversationId', { conversationId });
    }

    return qb.getMany();
  }

  async end(callId: string, userId: string) {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.initiatedBy !== userId) throw new ForbiddenException('Only the initiator can end this call');

    const now = new Date();
    call.status = 'ended';
    call.endedAt = now;
    call.duration = Math.round((now.getTime() - call.startedAt.getTime()) / 1000);
    return this.callRepo.save(call);
  }
}
