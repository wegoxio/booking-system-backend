import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
    constructor(
        private usersService: UserService
    ) { }


    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @Roles('SUPER_ADMIN')
    getUserByID(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @Roles('SUPER_ADMIN')
    createUser(@Body() data: CreateUserDto){
        return this.usersService.create(data);
    }
}
