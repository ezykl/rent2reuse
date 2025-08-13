export interface Item {
  id: string;
  itemName: string;
  images: string[];
  itemDesc: string;
  itemPrice: number;
  itemStatus: string;
  itemCondition: string;
  itemLocation: string;
  itemCategory: string;
  itemMinRentDuration?: number;
  createdAt: any;
  owner: {
    id: string;
    fullname: string;
    profileImage?: string; // Add this field
  };
}
