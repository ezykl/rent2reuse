export interface Item {
  id: string;
  itemName: string;
  images: string[];
  itemDesc: string;
  itemPrice: number;
  itemStatus: string;
  itemCondition: string;
  itemLocation: {
    latitude: number;
    longitude: number;
    address: string;
    radius?: number;
  };
  securityDepositPercentage?: number;
  enableAI?: boolean;
  itemCategory?: string;
  itemMinRentDuration?: number;
  createdAt: any;
  owner: {
    id: string;
    fullname: string;
    profileImage?: string;
  };
}
