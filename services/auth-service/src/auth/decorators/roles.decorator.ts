import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Role } from '../../../generated/client/index.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
