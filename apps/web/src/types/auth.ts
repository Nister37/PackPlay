export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

// ─── SSO & Account Settings Types ───────────────────────────────────────────

export type SsoProvider = 'google' | 'apple' | 'github' | string;

export interface SignInMethod {
  type: 'PASSWORD' | 'SSO';
  email: string;
  provider?: string;
  connectedAt?: string;
}

export interface EquipmentPreference {
  personalizedRanking?: boolean;
  personalizationEnabled?: boolean;
}

export interface ConnectRequest {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  receiverUserId: string;
  receiverEmail: string;
  ssoEmail: string;
  provider: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface SsoStartResponse {
  authorizationUrl: string;
}

export interface SsoCallbackResponse extends AuthTokens {
  user: User;
}
