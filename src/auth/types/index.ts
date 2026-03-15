import { UserRole } from "src/users/entities/user.entity";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  tenant_id: string | null;
  sid?: string | null;
  token_version?: number;
};

export type RefreshJwtPayload = {
  sub: string;
  sid: string;
  jti: string;
  token_version: number;
};

export type CurrentJwtUser = {
  sub: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  session_id: string | null;
  token_version: number;
  is_active: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  } | null;
};

export type AuthAccessTokenResponse = {
  access_token: string;
};

export type AuthTokensBundle = {
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  refresh_expires_at: Date;
};
