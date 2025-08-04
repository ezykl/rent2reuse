export interface User {
  uid?: string;
  firstname: string;
  middlename?: string;
  lastname: string;
  profileImage?: string;
  createdAt: string;
  contactNumber?: string;
  location?: {
    address: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  currentPlan?: {
    planId: string;
    planType: string;
    rentLimit: number;
    listLimit: number;
    rentUsed: number;
    listUsed: number;
    status: "active" | "inactive";
    subscriptionId?: string;
  };
  idVerified?: {
    idImage: string;
    idNumber: string;
    updatedAt: string;
  };
}
