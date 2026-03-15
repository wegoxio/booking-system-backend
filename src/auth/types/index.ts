import { UserRole } from "src/users/entities/user.entity";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  tenant_id: string | null;
};

export type CurrentJwtUser = {
  sub: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  is_active: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  } | null;
};