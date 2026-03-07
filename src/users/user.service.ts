import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User) private usersRepo: Repository<User>,
        @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    ) { }

    async findById(id: string) {
        const user = await this.usersRepo.findOneBy({ id });
        if (!user) throw new NotFoundException('Usuario no encontrado.');
        return {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            role: user?.role,
            tenant_id: user?.tenant_id,
            is_active: user?.is_active

        }
    }

    async create(dto: CreateUserDto) {
        const email = dto.email.toLowerCase().trim();
        const tenantId = dto.tenant_id;
        const existingEmail = await this.usersRepo.findOneBy({ email });
        if (existingEmail) throw new ConflictException('Ya existe un usuario con ese correo');

        const existingTenant = await this.tenantRepo.findOneBy({
            id: tenantId
        });

        if (!existingTenant) throw new NotFoundException('No existe un tenant con ese ID');

        const password_hash = await argon2.hash(dto.password);
        const newUser = this.usersRepo.create({
            name: dto.name,
            email,
            password_hash,
            role: dto.role,
            tenant_id: tenantId,
        });

        const createdUser = await this.usersRepo.save(newUser);
        return {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
            tenant_id: createdUser.tenant_id,
            is_active: createdUser.is_active,
        };
    }
}
