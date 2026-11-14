import {
  ItemCoverage,
  CoverageStatus,
  ResponsibilityData,
  CoverageResult,
} from './models/item-coverage';

export { CoverageStatus, ResponsibilityData, CoverageResult };

export function calculateCoverage(
  requiredQuantity: number,
  responsibilities: ResponsibilityData[],
  inventoryReservedQuantity = 0,
): CoverageResult {
  return ItemCoverage.calculate(
    requiredQuantity,
    responsibilities,
    inventoryReservedQuantity,
  );
}
