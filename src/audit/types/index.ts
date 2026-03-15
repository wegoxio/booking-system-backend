export type CreateAuditLogInput = {
    actor_user_id: string;
    tenant_id: string | null;
    action: string;
    message?: string | null;
    entity?: string | null;
    entity_id?: string | null;
    metadata?: Record<string, any> | null;
    ip?: string | null;
    user_agent?: string | null;
};

export type ListAuditLogsInput = {
    tenant_id?: string;
    actor_user_id?: string;
    action?: string;
    entity?: string;
    employee_id?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    page?: number;
    limit?: number;
};

export type AuditLogListItem = {
    id: string;
    created_at: Date;
    action: string;
    message: string;
    entity: string | null;
    entity_id: string | null;
    metadata: Record<string, any> | null;
    ip: string | null;
    user_agent: string | null;
    actor: {
        id: string;
        name: string;
        email: string;
        role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
    } | null;
    tenant: {
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
    } | null;
};