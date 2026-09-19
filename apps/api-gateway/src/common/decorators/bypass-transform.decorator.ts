import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const BYPASS_TRANSFORM_KEY = 'BYPASS_TRANSFORM_KEY';
export const BypassTransform = (): CustomDecorator<string> => SetMetadata(BYPASS_TRANSFORM_KEY, true);
