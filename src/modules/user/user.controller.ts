/*
https://docs.nestjs.com/controllers#controllers
*/

import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('User')
@ApiTags('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('validate/:unique_id')
    @ApiOperation({ summary: 'Validate User Account' })
    @ApiResponse({ status: 200, description: 'User account validated successfully.' })
    @ApiResponse({ status: 400, description: 'Validation failed.' })
    async validateUserAccount(@Param('unique_id') uniqueId: string): Promise<{ message: string }> {
        try {
            // Call the service method to validate the user account
            const result = await this.userService.validateAccount(uniqueId);
            return new ResponseDto(true, null, result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new HttpException(
                new ResponseDto(false, `Failed to validate user account - ${errorMessage}`, null, errorMessage),
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'List of all users' })
    findAll() {
        return this.userService.findAll();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({ status: 200, description: 'User found' })
    @ApiResponse({ status: 404, description: 'User not found' })
    findById(@Param('id') id: string) {
        return this.userService.findById(id);
    }

    @Patch(':id/membership')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update user membership tier' })
    updateMembership(@Param('id') id: string, @Body('membership') membership: string) {
        return this.userService.updateMembership(id, membership);
    }

    @Patch(':id/role')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update user role' })
    updateRole(@Param('id') id: string, @Body('role') role: string) {
        return this.userService.updateRole(id, role);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Delete a user' })
    @ApiResponse({ status: 200, description: 'User deleted' })
    deleteUser(@Param('id') id: string) {
        return this.userService.deleteUser(id);
    }

    @Post('heartbeat')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update presence — call every 2 minutes while app is open' })
    @ApiResponse({ status: 201, description: 'Presence updated' })
    heartbeat(@Request() req: any) {
        return this.userService.heartbeat(req.user.id);
    }

    @Get(':id/status')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get user online status' })
    @ApiResponse({ status: 200, description: 'User online status' })
    getStatus(@Param('id') id: string) {
        return this.userService.getStatus(id);
    }

    @Get(':id/phone')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Reveal phone number (premium feature)' })
    @ApiResponse({ status: 200, description: 'User phone number' })
    getPhone(@Param('id') id: string) {
        return this.userService.getPhone(id);
    }

    @Post(':id/block')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Block a user' })
    @ApiResponse({ status: 201, description: 'User blocked' })
    blockUser(@Param('id') id: string, @Request() req: any) {
        return this.userService.blockUser(req.user.id, id);
    }

    @Post(':id/report')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Report a user' })
    @ApiResponse({ status: 201, description: 'User reported' })
    reportUser(@Param('id') id: string, @Request() req: any, @Body('reason') reason: string) {
        return this.userService.reportUser(req.user.id, id, reason);
    }
}
