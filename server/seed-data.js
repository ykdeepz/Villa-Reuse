// Seed data for Villa-Reuse.
// These are the SAME demo records that used to live in src/data/systemStore.ts
// and src/data/profileData.ts as localStorage defaults. They are now inserted
// into the SQLite database the first time the server starts (empty DB only),
// so the classroom demo looks identical to the original prototype.
//
// Demo accounts: every account below uses the password  "villa2026"
// (stored on the server only as a salted scrypt hash — never in plaintext).

const DEMO_PASSWORD = "villa2026";

const USERS = [
  {
    id: "usr_member", name: "Jordan Lee", email: "member@villareuse.org",
    initials: "JL", neighborhood: "Downtown Villa", memberSince: 2023,
    coins: 120, itemsShared: 9, wasteSavedKg: 120,
    role: "Community Member",
    roleScope: "Post items, browse listings, request exchanges/donations, and manage your posts.",
    status: "Active", itemsCount: 9, joinedYear: 2023,
  },
  {
    id: "usr_donor", name: "Maria Santos", email: "donor@villareuse.org",
    initials: "MS", neighborhood: "Villa Verde East", memberSince: 2022,
    coins: 340, itemsShared: 24, wasteSavedKg: 285,
    role: "Item Donor / Provider",
    roleScope: "Provide items for donation or exchange and update item availability.",
    status: "Active", itemsCount: 24, joinedYear: 2022,
  },
  {
    id: "usr_moderator", name: "Alex Chen", email: "moderator@villareuse.org",
    initials: "AC", neighborhood: "Oakridge District", memberSince: 2021,
    coins: 450, itemsShared: 18, wasteSavedKg: 190,
    role: "Community Moderator",
    roleScope: "Review reported listings, manage inappropriate posts, and ensure reliable data.",
    status: "Active", itemsCount: 18, joinedYear: 2021,
  },
  {
    id: "usr_admin", name: "Samira Patel", email: "admin@villareuse.org",
    initials: "SP", neighborhood: "Villa Central HQ", memberSince: 2020,
    coins: 999, itemsShared: 42, wasteSavedKg: 520,
    role: "System Administrator",
    roleScope: "Manage users, system records, permissions, and system audit logs.",
    status: "Active", itemsCount: 42, joinedYear: 2020,
  },
];

const ITEMS = [
  { id: "item_1", title: "Denim Jacket", description: "Classic vintage denim jacket in excellent shape. Light wash, unisex size M. Warm and sturdy for everyday use.", category: "Clothes", condition: "Good", listingType: "Donation", status: "Available", donorId: "usr_donor", donorName: "Maria Santos", distanceKm: 1.2, postedAgo: "2 hours ago", coins: 20, image: "assets/denim-jacket.png", details: "Size M · 80% Good" },
  { id: "item_2", title: "Electric Kettle", description: "Stainless steel 1.7L rapid boil kettle with auto shut-off and clean filter. Fully working.", category: "Appliances", condition: "Good", listingType: "Exchange", exchangeFor: "Desk fan or blender", status: "Requested", donorId: "usr_member", donorName: "Jordan Lee", distanceKm: 0.8, postedAgo: "5 hours ago", coins: 45, image: "assets/electric-kettle.png", details: "Works Well · Rapid Boil" },
  { id: "item_3", title: "Design Handbook", description: "Comprehensive UI/UX and visual design reference book. Clean pages with no notes or highlights.", category: "Books", condition: "Like New", listingType: "Donation", status: "Available", donorId: "usr_donor", donorName: "Maria Santos", distanceKm: 2.1, postedAgo: "1 day ago", coins: 15, image: "assets/design-handbook.png", details: "Hardcover · Like New" },
  { id: "item_4", title: "Ceramic Table Set", description: "4-piece handcrafted ceramic dinner set. Includes 2 bowls, 2 plates, earth-tone glaze.", category: "Household Items", condition: "Good", listingType: "Exchange", exchangeFor: "Indoor planters or plant cuttings", status: "Reserved", donorId: "usr_donor", donorName: "Maria Santos", distanceKm: 3.4, postedAgo: "2 days ago", coins: 30, image: "assets/ceramic-table-set.png", details: "4-piece set · Earth Tone" },
  { id: "item_5", title: "Graphing Calculator & Ruler Set", description: "Scientific graphing calculator with high-contrast display plus complete geometry ruler set. Great for high school or college students.", category: "School Supplies", condition: "Like New", listingType: "Donation", status: "Available", donorId: "usr_member", donorName: "Jordan Lee", distanceKm: 1.5, postedAgo: "3 days ago", coins: 25, image: "assets/design-handbook.png", details: "Calculator + Ruler Kit" },
  { id: "item_6", title: "Wooden Study Desk Chair", description: "Solid birch wooden chair with ergonomic curved backrest. Perfect for student room or home office.", category: "Furniture", condition: "Fair", listingType: "Exchange", exchangeFor: "Desk organizer or bookshelf", status: "Available", donorId: "usr_donor", donorName: "Maria Santos", distanceKm: 2.8, postedAgo: "4 days ago", coins: 40, image: "assets/ceramic-table-set.png", details: "Solid Birch · Ergonomic" },
];

const REQUESTS = [
  { id: "req_1", itemId: "item_2", itemTitle: "Electric Kettle", requesterId: "usr_member", requesterName: "Jordan Lee", donorId: "usr_donor", donorName: "Maria Santos", type: "Exchange Proposal", exchangeOffer: "Offering a 2-speed countertop fruit blender in great condition.", note: "Hi Maria! I've been looking for an electric kettle for my dorm. Hope the blender is useful!", pickupTime: "Weekday evenings between 5 PM and 7 PM", status: "Pending", createdAt: "Nov 24, 2026, 4:15 PM" },
  { id: "req_2", itemId: "item_4", itemTitle: "Ceramic Table Set", requesterId: "usr_member", requesterName: "Elena Rostova", donorId: "usr_donor", donorName: "Maria Santos", type: "Exchange Proposal", exchangeOffer: "Offering 3 potted succulents with ceramic trays.", note: "Would love to trade for these gorgeous ceramic plates!", pickupTime: "Saturday morning at the community center", status: "Accepted", createdAt: "Nov 23, 2026, 11:30 AM" },
  { id: "req_3", itemId: "item_3", itemTitle: "Design Handbook", requesterId: "usr_member", requesterName: "Jordan Lee", donorId: "usr_donor", donorName: "Maria Santos", type: "Donation Request", note: "Starting my product design course this term and this handbook would be a lifesaver.", pickupTime: "Anytime tomorrow afternoon", status: "Completed", createdAt: "Nov 20, 2026, 2:00 PM" },
];

const REPORTS = [
  { id: "rep_1", itemId: "item_6", itemTitle: "Wooden Study Desk Chair", reporterName: "Carlos Diaz", reason: "Damaged or unsafe item", details: "Left front leg appears slightly wobbly in the photo. Please ask donor to confirm safety.", status: "Open", createdAt: "Nov 24, 2026, 1:20 PM" },
  { id: "rep_2", itemId: "item_1", itemTitle: "Denim Jacket", reporterName: "Anon Community Resident", reason: "Misleading description", details: "Checked previous listing, believed it might be size S rather than M.", status: "Dismissed", createdAt: "Nov 22, 2026, 9:45 AM" },
];

const LOGS = [
  { id: "log_1", timestamp: "2026-11-24 16:15", actor: "Jordan Lee", role: "Community Member", action: "Exchange Request Submitted", details: "Submitted exchange proposal for item #item_2 (Electric Kettle)" },
  { id: "log_2", timestamp: "2026-11-24 13:20", actor: "Carlos Diaz", role: "Community Member", action: "Listing Reported", details: "Reported #item_6 (Wooden Study Desk Chair) for safety verification" },
  { id: "log_3", timestamp: "2026-11-23 14:00", actor: "Maria Santos", role: "Item Donor / Provider", action: "Request Accepted", details: "Accepted request #req_2 from Elena Rostova for #item_4" },
  { id: "log_4", timestamp: "2026-11-22 10:15", actor: "Alex Chen", role: "Community Moderator", action: "Report Reviewed & Dismissed", details: "Dismissed report #rep_2 on #item_1 after donor confirmed sizing tag" },
  { id: "log_5", timestamp: "2026-11-20 09:30", actor: "Samira Patel", role: "System Administrator", action: "System Audit Maintenance", details: "Verified waste diversion metrics and community ReUse Coin ledger" },
];

module.exports = { DEMO_PASSWORD, USERS, ITEMS, REQUESTS, REPORTS, LOGS };
