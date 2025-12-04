export interface PickupAssessmentData {
  itemCondition: {
    isComplete: boolean;
    hasDamage: boolean;
    description: string;
    damageDetails: string;
  };
  checklist: {
    allPartsPresent: boolean;
    functionalityOk: boolean;
    cleanCondition: boolean;
    noOdor: boolean;
    otherNotes: string;
  };
  photos: string[];
}

export interface ReturnAssessmentData {
  itemCondition: {
    isComplete: boolean;
    hasDamage: boolean;
    description: string;
    damageDetails: string;
  };
  checklist: {
    allPartsPresent: boolean;
    functionalityOk: boolean;
    cleanCondition: boolean;
    noOdor: boolean;
    otherNotes: string;
  };
  photos: string[];
}

export type AssessmentData = PickupAssessmentData | ReturnAssessmentData;