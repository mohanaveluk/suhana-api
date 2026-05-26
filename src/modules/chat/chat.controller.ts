import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    Query,
    HttpStatus,
    UseGuards,
    BadRequestException,
    Req,
    Request,
    Patch,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { Request as ExpRequest } from 'express';
import { ResponseDto } from 'src/common/dto/response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import Anthropic from "@anthropic-ai/sdk";
import { ChatService } from './chat.service';
import { SendMessageDto, StartConversationDto } from './dto/chat.dto';


@ApiTags('chat')
@Controller('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(
        // Inject any required services here, e.g., ChatService
        private readonly anthropic: Anthropic, // Replace with actual type of the service
        private readonly chatService: ChatService
    ) { }

    @Post('request')
    @ApiOperation({
        summary: 'Chat with the suhana assistant',
        description: 'Send a message to the suhana assistant and receive a response.',
    })
    @ApiBody({
        description: 'Message to send to the suhana assistant',
        schema: {
            type: 'object',
            properties: {
                messages: {
                    type: 'string',
                    example: 'What is the current status of my suhana?',
                },
            },
            required: ['message'],
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Response from the suhana assistant',
        schema: {
            type: 'object',
            properties: {
                response: {
                    type: 'string',
                    example: 'Your suhana is currently published and has received 150 votes.',
                },
            },
        },
    })
    async chat(@Body() body: { messages: any[]; system: string }) {

        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: body.system,
            messages: body.messages,
        });

        //return new ResponseDto<string>(true, 'Response from suhana assistant',response, null);
        return response;

    }

    @Get('conversations')
    @ApiOperation({ summary: 'Get all conversations for the current user' })
    @ApiResponse({ status: 200, description: 'List of conversations' })
    getConversations(@Request() req: any) {
        return this.chatService.getConversations(req.user.id);
    }

    @Get('conversations/:id/messages')
    @ApiOperation({ summary: 'Get messages for a conversation' })
    @ApiResponse({ status: 200, description: 'List of messages' })
    getMessages(@Param('id') id: string) {
        return this.chatService.getMessages(id);
    }

    @Post('conversations')
    @ApiOperation({ summary: 'Start a new conversation' })
    @ApiResponse({ status: 201, description: 'Conversation created' })
    startConversation(@Request() req: any, @Body() dto: StartConversationDto) {
        return this.chatService.startConversation(req.user.id, dto.receiverId);
    }

    @Post('conversations/:id/messages')
    @ApiOperation({ summary: 'Send a message in a conversation' })
    @ApiResponse({ status: 201, description: 'Message sent' })
    sendMessage(@Param('id') id: string, @Request() req: any, @Body() dto: SendMessageDto) {
        return this.chatService.sendMessage(id, req.user.id, dto.content, dto.type);
    }

    @Patch('conversations/:id/read')
    @ApiOperation({ summary: 'Mark all messages as read in a conversation' })
    markAsRead(@Param('id') id: string, @Request() req: any) {
        return this.chatService.markAsRead(id, req.user.id);
    }

    @Get('icebreakers')
    @ApiOperation({ summary: 'Get list of icebreaker messages' })
    @ApiResponse({ status: 200, description: 'List of icebreaker suggestions' })
    getIcebreakers() {
        return this.chatService.getIcebreakers();
    }
}