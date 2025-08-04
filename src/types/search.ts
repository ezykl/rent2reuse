export interface SearchResult {
  id: string;
  itemName: string;
  images: string[];
  itemDesc: string;
  itemPrice: number;
  itemStatus: string;
  itemCondition: string;
  itemLocation: string;
  owner: {
    id: string;
    fullname: string;
  };
}
