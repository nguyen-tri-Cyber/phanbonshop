import { Injectable } from '@nestjs/common';
import {
  calculateShippingFee,
  ShippingCalculationInput,
  ShippingCalculationResult,
} from '@phanbonshop/shared-utils';
export type {
  ShippingCalculationInput,
  ShippingCalculationResult,
} from '@phanbonshop/shared-utils';

@Injectable()
export class ShippingService {
  calculateShippingFee(input: ShippingCalculationInput): ShippingCalculationResult {
    return calculateShippingFee(input);
  }
}
