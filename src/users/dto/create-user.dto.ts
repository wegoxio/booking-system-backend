import { IsEmail, IsString, IsStrongPassword } from "class-validator";
import type { UserRole } from "../entities/user.entity";

export class CreateUserDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsStrongPassword()
    password: string;

    @IsString()
    role: UserRole;

    @IsString()
    tenant_id: string;
}