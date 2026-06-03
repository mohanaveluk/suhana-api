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
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request as ExpRequest } from 'express';
import { ResponseDto } from 'src/common/dto/response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import Anthropic from "@anthropic-ai/sdk";
import { ChatService } from './chat.service';
import { SendMessageDto, StartConversationDto, TypingDto } from './dto/chat.dto';


@ApiTags('chat')
@Controller('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(
        private readonly anthropic: Anthropic,
        private readonly chatService: ChatService,
        private readonly cloudStorageService: CloudStorageService,
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

    @Post('conversations/:id/attachments')
    @ApiOperation({ summary: 'Send a file attachment in a conversation' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 201, description: 'Attachment sent' })
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async sendAttachment(
        @Param('id') id: string,
        @Request() req: any,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('No file provided');
        await this.cloudStorageService.isFileValid(file);
        const url = await this.cloudStorageService.uploadFile(file, 'chat-attachments');
        return this.chatService.sendAttachment(id, req.user.id, url);
    }

    @Get('conversations/:id/typing')
    @ApiOperation({ summary: 'Get partner typing status' })
    @ApiResponse({ status: 200, description: 'Typing status' })
    getTypingIndicator(@Param('id') id: string, @Request() req: any) {
        return this.chatService.getTyping(id, req.user.id);
    }

    @Post('conversations/:id/typing')
    @ApiOperation({ summary: 'Send typing indicator' })
    @ApiResponse({ status: 200, description: 'Typing indicator acknowledged' })
    sendTypingIndicator(@Param('id') id: string, @Request() req: any, @Body() dto: TypingDto) {
        return this.chatService.setTyping(id, req.user.id, dto.isTyping);
    }

    @Delete('conversations/:id/messages/:messageId')
    @ApiOperation({ summary: 'Delete a message (sender only)' })
    @ApiResponse({ status: 200, description: 'Message deleted' })
    @ApiResponse({ status: 403, description: 'Cannot delete another user\'s message' })
    deleteMessage(@Param('id') id: string, @Param('messageId') messageId: string, @Request() req: any) {
        return this.chatService.deleteMessage(id, messageId, req.user.id);
    }

    @Get('icebreakers')
    @ApiOperation({ summary: 'Get list of icebreaker messages' })
    @ApiResponse({ status: 200, description: 'List of icebreaker suggestions' })
    getIcebreakers() {
        return this.chatService.getIcebreakers();
    }
}