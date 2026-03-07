import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Repository } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
    constructor(
        @InjectRepository(Tenant) private tenantRepository: Repository<Tenant>
    ) { }

    async create(dto: CreateTenantDto): Promise<Tenant> {
        const existingTenant = await this.findBySlug(dto.slug);
        if (existingTenant) throw new ConflictException('Ya existe un usuario con ese slug.');

        const newTenant = await this.tenantRepository.create(dto);
        await this.tenantRepository.save(newTenant)
        return newTenant;
    }


    async findBySlug(slug: string) {
        return this.tenantRepository.findOneBy({ slug });
    }

    async findAll(){
        const tenants = await this.tenantRepository.findAndCount();
        return tenants
    }
}
