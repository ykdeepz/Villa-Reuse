export type Category =
  | "Clothes"
  | "Appliances"
  | "Books"
  | "School Supplies"
  | "Household Items"
  | "Furniture"
  | "Others";

export type CategoryFilter = "All" | Category;

export type ItemCondition = "Like New" | "Good" | "Fair";

export type ListingType = "Donation" | "Exchange";

export type ItemStatus =
  | "Available"
  | "Requested"
  | "Reserved"
  | "Donated"
  | "Exchanged"
  | "Completed";

export interface Item {
  id: string;
  title: string;
  description: string;
  category: Category;
  condition: ItemCondition;
  listingType: ListingType;
  exchangeFor?: string;
  status: ItemStatus;
  donorId: string;
  donorName: string;
  distanceKm: number;
  postedAgo: string;
  coins: number;
  image: string;
  details?: string;
  hidden?: boolean;
}

export type RequestStatus = "Pending" | "Accepted" | "Rejected" | "Completed";

export interface ItemRequest {
  id: string;
  itemId: string;
  itemTitle: string;
  requesterId: string;
  requesterName: string;
  donorId: string;
  donorName: string;
  type: "Donation Request" | "Exchange Proposal";
  exchangeOffer?: string;
  note: string;
  pickupTime: string;
  status: RequestStatus;
  createdAt: string;
}

export type ReportStatus = "Open" | "Dismissed" | "Listing Removed";

export interface ListingReport {
  id: string;
  itemId: string;
  itemTitle: string;
  reporterName: string;
  reason: "Misleading description" | "Inappropriate content" | "Damaged or unsafe item" | "Duplicate / spam";
  details: string;
  status: ReportStatus;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  details: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "Community Member" | "Community Moderator" | "System Administrator";
  neighborhood: string;
  status: "Active" | "Suspended";
  itemsCount: number;
  joinedYear: number;
}

export interface FilterState {
  category: CategoryFilter;
  listingType: "All" | ListingType;
  condition: "All" | ItemCondition;
  query: string;
}
