/** Authenticated user shape placed on req.user after JWT validation. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

/** JWT payload embedded inside access tokens. */
export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access';
}

