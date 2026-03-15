import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Request } from 'express';
import type { CurrentJwtUser } from './types';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService){}

    @Post('login')
    login(@Body() dto: LoginDto, @Req() req: Request){
        return this.authService.login(dto, {
            ip: req.ip ?? null,
            user_agent: req.headers['user-agent'] ?? null,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: CurrentJwtUser){
        return user;
    }
}
