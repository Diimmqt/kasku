import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a controller or route handler as publicly accessible without JWT auth. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

