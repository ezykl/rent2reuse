import { ToolCategory } from "../types/ai-types";

// Primary lookup map for tool name to category
export const TOOL_TO_CATEGORY: { [toolName: string]: string } = {
  // Power Tools & Hand Tools
  "Adjustable Wrench": "Power Tools & Hand Tools",
  "Angle Grinder": "Power Tools & Hand Tools",
  "Belt Sander": "Power Tools & Hand Tools",
  "Bench Grinder": "Power Tools & Hand Tools",
  "Brad Nailer": "Power Tools & Hand Tools",
  "Caulking Gun": "Power Tools & Hand Tools",
  "Chainsaw": "Power Tools & Hand Tools",
  "Circular Saw": "Power Tools & Hand Tools",
  "Claw Hammer": "Power Tools & Hand Tools",
  "Combination Wrench Set": "Power Tools & Hand Tools",
  "Cordless Drill": "Power Tools & Hand Tools",
  "Crimping Tool": "Power Tools & Hand Tools",
  "Crowbar": "Power Tools & Hand Tools",
  "Drywall Screw Gun": "Power Tools & Hand Tools",
  "Drywall Trowel": "Power Tools & Hand Tools",
  "Electric Planer": "Power Tools & Hand Tools",
  "Electric ScrewDriver": "Power Tools & Hand Tools",
  "Finishing Nailer": "Power Tools & Hand Tools",
  "Flathead Screwdriver Set": "Power Tools & Hand Tools",
  "Floor Scraper": "Power Tools & Hand Tools",
  "Hacksaw": "Power Tools & Hand Tools",
  "Hammer Drill": "Power Tools & Hand Tools",
  "Hand Saw": "Power Tools & Hand Tools",
  "Heat Gun": "Power Tools & Hand Tools",
  "Impact Wrench": "Power Tools & Hand Tools",
  "Jackhammer": "Power Tools & Hand Tools",
  "Jigsaw": "Power Tools & Hand Tools",
  "Metal Shears": "Power Tools & Hand Tools",
  "Needle Nose Pliers": "Power Tools & Hand Tools",
  "PEX Crimping Tool": "Power Tools & Hand Tools",
  "PVC Cutter": "Power Tools & Hand Tools",
  "Phillips Screwdriver Set": "Power Tools & Hand Tools",
  "Pickaxe": "Power Tools & Hand Tools",
  "Pipe Threader": "Power Tools & Hand Tools",
  "Pipe Wrench": "Power Tools & Hand Tools",
  "Putty Knife": "Power Tools & Hand Tools",
  "Rebar Cutter": "Power Tools & Hand Tools",
  "Router Tool": "Power Tools & Hand Tools",
  "Rubber Mallet": "Power Tools & Hand Tools",
  "Scissor": "Power Tools & Hand Tools",
  "Sledgehammer": "Power Tools & Hand Tools",
  "Slip Joint Pliers": "Power Tools & Hand Tools",
  "Socket Wrench Set": "Power Tools & Hand Tools",
  "Tin Snips": "Power Tools & Hand Tools",
  "Torque Wrench": "Power Tools & Hand Tools",
  "Torx Screwdriver Set": "Power Tools & Hand Tools",
  "Utility Knife": "Power Tools & Hand Tools",
  "Vise Grip": "Power Tools & Hand Tools",
  "Welding Clamps": "Power Tools & Hand Tools",
  "Welding Machine": "Power Tools & Hand Tools",
  "Wire Strippers": "Power Tools & Hand Tools",
  "Wood Hand Planer": "Power Tools & Hand Tools",

  // Construction & Workshop Equipment
  "Air Compressor": "Construction & Workshop Equipment",
  "Concrete Mixer": "Construction & Workshop Equipment",
  "Concrete Saw": "Construction & Workshop Equipment",
  "Drain Auger": "Construction & Workshop Equipment",
  "Earth Auger": "Construction & Workshop Equipment",
  "Engine Hoist": "Construction & Workshop Equipment",
  "Extension Ladder": "Construction & Workshop Equipment",
  "Ladder": "Construction & Workshop Equipment",
  "Portable Generator": "Construction & Workshop Equipment",
  "Power Trowel": "Construction & Workshop Equipment",
  "Pressure Washer": "Construction & Workshop Equipment",
  "Scaffold Tower": "Construction & Workshop Equipment",
  "Tool Box": "Construction & Workshop Equipment",
  "Tool Chest": "Construction & Workshop Equipment",
  "Wallpaper Steamer": "Construction & Workshop Equipment",
  "Water Pump": "Construction & Workshop Equipment",
  "Welding Helmet": "Construction & Workshop Equipment",
  "Welding Table": "Construction & Workshop Equipment",
  "Wet Tile Saw": "Construction & Workshop Equipment",

  // Audio & Visual Equipment
  "Action Camera": "Audio & Visual Equipment",
  "Audio Mixer": "Audio & Visual Equipment",
  "Boom Microphone": "Audio & Visual Equipment",
  "DJ Controller": "Audio & Visual Equipment",
  "DSLR camera": "Audio & Visual Equipment",
  "Drone": "Audio & Visual Equipment",
  "Gimbal Stabilizer": "Audio & Visual Equipment",
  "Headphone": "Audio & Visual Equipment",
  "Lavalier Microphone": "Audio & Visual Equipment",
  "Microphone Stand": "Audio & Visual Equipment",
  "Projector": "Audio & Visual Equipment",
  "Projector Screen": "Audio & Visual Equipment",
  "Sound System": "Audio & Visual Equipment",
  "Wireless Microphone Kit": "Audio & Visual Equipment",
  "Wireless Speaker": "Audio & Visual Equipment",

  // Electronics & Computing
  "Laptop": "Electronics & Computing",
  "Monitor": "Electronics & Computing",

  // Gardening Tools
  "Axe": "Gardening Tools",
  "Garden Rake": "Gardening Tools",
  "Garden Tiller": "Gardening Tools",
  "Hedge Trimmer": "Gardening Tools",
  "Hoe": "Gardening Tools",
  "Lawn Mower": "Gardening Tools",
  "Leaf Blower": "Gardening Tools",
  "Loppers": "Gardening Tools",
  "Post Hole Digger": "Gardening Tools",
  "Shovel": "Gardening Tools",
  "String Trimmer": "Gardening Tools",

  // Camping & Outdoor Gear
  "Camping Cot": "Camping & Outdoor Gear",
  "Camping Tent": "Camping & Outdoor Gear",
  "Folding Camping Chair": "Camping & Outdoor Gear",
  "Pop-up Canopy Tent": "Camping & Outdoor Gear",
  "Portable Camping Stove": "Camping & Outdoor Gear",
  "Portable Cooler": "Camping & Outdoor Gear",
  "Sleeping Bag": "Camping & Outdoor Gear",

  // Measuring & Detection Tools
  "Clamp Meter": "Measuring & Detection Tools",
  "Combination Square": "Measuring & Detection Tools",
  "Infrared Thermometer": "Measuring & Detection Tools",
  "Laser Level": "Measuring & Detection Tools",
  "Metal Detector": "Measuring & Detection Tools",
  "Multimeter": "Measuring & Detection Tools",
  "Spirit Level": "Measuring & Detection Tools",
  "Tape Measure": "Measuring & Detection Tools",
  "Thermal Camera": "Measuring & Detection Tools",
  "Voltage Tester": "Measuring & Detection Tools",
  "Wire Tracer": "Measuring & Detection Tools",

  // Cleaning Equipment
  "Air Mover": "Cleaning Equipment",
  "Dust Extractor": "Cleaning Equipment",
  "Floor Polisher": "Cleaning Equipment",
  "Shop Vacuum": "Cleaning Equipment",
  "Steam Cleaner": "Cleaning Equipment",
  "Vacuum Cleaner": "Cleaning Equipment",

  // Lifting & Moving Tools
  "Car Jack": "Lifting & Moving Tools",
  "Electric Hoist": "Lifting & Moving Tools",
  "Hand Truck": "Lifting & Moving Tools",
  "Jack Stands": "Lifting & Moving Tools",

  // Lighting & Photography
  "Camera Tripod": "Lighting & Photography",
  "Portable Green Screen": "Lighting & Photography",
  "Ring Light": "Lighting & Photography",
  "Studio Softbox Kit": "Lighting & Photography",
  "Work Light": "Lighting & Photography",

  // Automotive Tools
  "Car Battery Charger": "Automotive Tools",
  "Car Polisher": "Automotive Tools",
  "Tire Inflator": "Automotive Tools",

  // Event & Entertainment Equipment
  "Ball": "Event & Entertainment Equipment",
  "Book": "Event & Entertainment Equipment",
  "Bounce House": "Event & Entertainment Equipment",
  "Folding Chairs": "Event & Entertainment Equipment",
  "Folding Tables": "Event & Entertainment Equipment",
  "Stroller": "Event & Entertainment Equipment",

  // Safety Equipment
  "Hard Hat": "Safety Equipment",

  // Specialty Tools
  "Extension Cord Reel": "Specialty Tools",
  "Heavy-Duty Fan": "Specialty Tools",
  "Wood Carving Kit": "Specialty Tools",
};

// Prohibited items map
export const PROHIBITED_ITEMS: { [itemName: string]: string } = {
  // Consumables & Perishables
  "Beverages": "Consumables & Perishables",
  "Butane & LPG": "Consumables & Perishables",
  "Canned & Packaged Food": "Consumables & Perishables",
  "Fresh & Frozen Food": "Consumables & Perishables",
  "Prescription Drugs & Medicine": "Consumables & Perishables",
  "Served Food": "Consumables & Perishables",

  // Vehicles & Transportation
  "Bike & E-Bike": "Vehicles & Transportation",
  "Motorbike & Scooter": "Vehicles & Transportation",
  "Pickup Truck": "Vehicles & Transportation",
  "Rental Car": "Vehicles & Transportation",

  // Weapons & Dangerous Items
  "Explosive": "Weapons & Dangerous Items",
  "Firearms": "Weapons & Dangerous Items",
  "Hand-to-Hand Combat Weapon": "Weapons & Dangerous Items",
  "Hazardous Waste": "Weapons & Dangerous Items",

  // Real Estate & Property
  "Houses & Apartments": "Real Estate & Property",
  "Office Space": "Real Estate & Property",
  "Storage Unit & Locker": "Real Estate & Property",

  // Personal & Identity Items
  "Cosmetics Products": "Personal & Identity Items",
  "Everyday Clothing": "Personal & Identity Items",
  "Identity documents": "Personal & Identity Items",
  "Jewelry & Personal Accessories": "Personal & Identity Items",
  "Oral Care Products": "Personal & Identity Items",
  "Shoes & Footwear": "Personal & Identity Items",
  "Undergarments": "Personal & Identity Items",

  // Animals & Livestock
  "Livestock": "Animals & Livestock",
  "Pet": "Animals & Livestock",

  // Medical & Hygiene Products
  "Medical Textiles Product": "Medical & Hygiene Products",
  "Mouthguards": "Medical & Hygiene Products",
  "Prosthetic Equipments": "Medical & Hygiene Products",
  "Socks & Hosiery": "Medical & Hygiene Products",
  "Syringes & Needles": "Medical & Hygiene Products",
  "Towels & Bathrobes": "Medical & Hygiene Products",

  // Illegal & Financial Items
  "Gambling Items": "Illegal & Financial Items",
  "Lighter": "Illegal & Financial Items",
  "Money": "Illegal & Financial Items",
};

// Category metadata
export const CATEGORY_INFO: { [categoryName: string]: { count: number; isAccepted: boolean } } = {
  // Accepted categories
  "Power Tools & Hand Tools": { count: 55, isAccepted: true },
  "Construction & Workshop Equipment": { count: 19, isAccepted: true },
  "Audio & Visual Equipment": { count: 15, isAccepted: true },
  "Electronics & Computing": { count: 2, isAccepted: true },
  "Gardening Tools": { count: 11, isAccepted: true },
  "Camping & Outdoor Gear": { count: 7, isAccepted: true },
  "Measuring & Detection Tools": { count: 11, isAccepted: true },
  "Cleaning Equipment": { count: 6, isAccepted: true },
  "Lifting & Moving Tools": { count: 4, isAccepted: true },
  "Lighting & Photography": { count: 5, isAccepted: true },
  "Automotive Tools": { count: 3, isAccepted: true },
  "Event & Entertainment Equipment": { count: 6, isAccepted: true },
  "Safety Equipment": { count: 1, isAccepted: true },
  "Specialty Tools": { count: 3, isAccepted: true },

  // Prohibited categories
  "Consumables & Perishables": { count: 6, isAccepted: false },
  "Vehicles & Transportation": { count: 4, isAccepted: false },
  "Weapons & Dangerous Items": { count: 4, isAccepted: false },
  "Real Estate & Property": { count: 3, isAccepted: false },
  "Personal & Identity Items": { count: 7, isAccepted: false },
  "Animals & Livestock": { count: 2, isAccepted: false },
  "Medical & Hygiene Products": { count: 6, isAccepted: false },
  "Illegal & Financial Items": { count: 3, isAccepted: false },
};

// Combined lookup (accepted + prohibited)
export const ALL_ITEMS_TO_CATEGORY: { [itemName: string]: string } = {
  ...TOOL_TO_CATEGORY,
  ...PROHIBITED_ITEMS,
};

// Utility functions
export const getToolCategory = (toolName: string): string | null => {
  if (!toolName) return null;
  
  // Try exact match first
  if (ALL_ITEMS_TO_CATEGORY[toolName]) {
    return ALL_ITEMS_TO_CATEGORY[toolName];
  }
  
  // Try case-insensitive match
  const cleanToolName = toolName.trim();
  const exactMatch = Object.keys(ALL_ITEMS_TO_CATEGORY).find(
    key => key.toLowerCase() === cleanToolName.toLowerCase()
  );
  
  return exactMatch ? ALL_ITEMS_TO_CATEGORY[exactMatch] : null;
};

export const isToolAccepted = (toolName: string): boolean => {
  const category = getToolCategory(toolName);
  if (!category) return false;
  return CATEGORY_INFO[category]?.isAccepted || false;
};

export const isToolProhibited = (toolName: string): boolean => {
  return !isToolAccepted(toolName) && getToolCategory(toolName) !== null;
};

export const getCategoryInfo = (categoryName: string) => {
  return CATEGORY_INFO[categoryName] || null;
};

export const getToolsInCategory = (categoryName: string): string[] => {
  return Object.keys(ALL_ITEMS_TO_CATEGORY).filter(
    tool => ALL_ITEMS_TO_CATEGORY[tool] === categoryName
  );
};

export const getAcceptedCategories = (): string[] => {
  return Object.keys(CATEGORY_INFO).filter(
    category => CATEGORY_INFO[category].isAccepted
  );
};

export const getProhibitedCategories = (): string[] => {
  return Object.keys(CATEGORY_INFO).filter(
    category => !CATEGORY_INFO[category].isAccepted
  );
};

export const getAcceptedTools = (): string[] => {
  return Object.keys(TOOL_TO_CATEGORY);
};

export const getProhibitedTools = (): string[] => {
  return Object.keys(PROHIBITED_ITEMS);
};

export const getAllTools = (): string[] => {
  return Object.keys(ALL_ITEMS_TO_CATEGORY);
};

// Get category status
export const getCategoryStatus = (toolName: string): 'accepted' | 'prohibited' | 'unknown' => {
  const category = getToolCategory(toolName);
  if (!category) return 'unknown';
  
  const categoryInfo = CATEGORY_INFO[category];
  if (!categoryInfo) return 'unknown';
  
  return categoryInfo.isAccepted ? 'accepted' : 'prohibited';
};

// Original arrays for backward compatibility
export const ACCEPTED_CATEGORIES: ToolCategory[] = [
  {
    name: "Power Tools & Hand Tools",
    count: 55,
    examples: ["Adjustable Wrench", "Angle Grinder", "Belt Sander", "Circular Saw", "Cordless Drill", "Hammer Drill", "Jackhammer", "Welding Machine"],
  },
  {
    name: "Construction & Workshop Equipment",
    count: 19,
    examples: ["Concrete Mixer", "Concrete Saw", "Engine Hoist", "Scaffold Tower", "Tool Chest", "Power Trowel"],
  },
  {
    name: "Audio & Visual Equipment",
    count: 15,
    examples: ["Audio Mixer", "Boom Microphone", "DSLR camera", "Lavalier Microphone", "Microphone Stand", "Projector"],
  },
  {
    name: "Electronics & Computing",
    count: 2,
    examples: ["Laptop", "Monitor"],
  },
  {
    name: "Gardening Tools",
    count: 11,
    examples: ["Garden Rake", "Hedge Trimmer", "Hoe", "Lawn Mower", "Leaf Blower", "Loppers"],
  },
  {
    name: "Camping & Outdoor Gear",
    count: 7,
    examples: ["Camping Cot", "Camping Tent", "Folding Camping Chair", "Sleeping Bag", "Portable Cooler", "Pop-up Canopy Tent"],
  },
  {
    name: "Measuring & Detection Tools",
    count: 11,
    examples: ["Clamp Meter", "Combination Square", "Infrared Thermometer", "Laser Level", "Multimeter", "Voltage Tester"],
  },
  {
    name: "Cleaning Equipment",
    count: 6,
    examples: ["Dust Extractor", "Floor Polisher", "Shop Vacuum", "Steam Cleaner", "Vacuum Cleaner"],
  },
  {
    name: "Lifting & Moving Tools",
    count: 4,
    examples: ["Car Jack", "Electric Hoist", "Hand Truck", "Jack Stands"],
  },
  {
    name: "Lighting & Photography",
    count: 5,
    examples: ["Camera Tripod", "Ring Light", "Studio Softbox Kit", "Portable Green Screen", "Work Light"],
  },
  {
    name: "Automotive Tools",
    count: 3,
    examples: ["Car Battery Charger", "Car Polisher", "Tire Inflator"],
  },
  {
    name: "Event & Entertainment Equipment",
    count: 6,
    examples: ["Ball", "Book", "Bounce House", "Folding Chairs", "Folding Tables", "Stroller"],
  },
  {
    name: "Safety Equipment",
    count: 1,
    examples: ["Hard Hat"],
  },
  {
    name: "Specialty Tools",
    count: 3,
    examples: ["Extension Cord Reel", "Heavy-Duty Fan", "Wood Carving Kit"],
  },
];

export const PROHIBITED_CATEGORIES: ToolCategory[] = [
  {
    name: "Consumables & Perishables",
    count: 6,
    examples: ["Beverages", "Fresh & Frozen Food", "Served Food", "Canned & Packaged Food", "Butane & LPG", "Prescription Drugs & Medicine"],
  },
  {
    name: "Vehicles & Transportation",
    count: 4,
    examples: ["Bike & E-Bike", "Motorbike & Scooter", "Pickup Truck", "Rental Car"],
  },
  {
    name: "Weapons & Dangerous Items",
    count: 4,
    examples: ["Firearms", "Explosive", "Hand-to-Hand Combat Weapon", "Hazardous Waste"],
  },
  {
    name: "Real Estate & Property",
    count: 3,
    examples: ["Houses & Apartments", "Office Space", "Storage Unit & Locker"],
  },
  {
    name: "Personal & Identity Items",
    count: 7,
    examples: ["Everyday Clothing", "Identity documents", "Jewelry & Personal Accessories", "Oral Care Products", "Undergarments", "Shoes & Footwear", "Cosmetics Products"],
  },
  {
    name: "Animals & Livestock",
    count: 2,
    examples: ["Pet", "Livestock"],
  },
  {
    name: "Medical & Hygiene Products",
    count: 6,
    examples: ["Medical Textiles Product", "Syringes & Needles", "Towels & Bathrobes", "Socks & Hosiery", "Mouthguards", "Prosthetic Equipments"],
  },
  {
    name: "Illegal & Financial Items",
    count: 3,
    examples: ["Gambling Items", "Money", "Lighter"],
  },
];

// Legacy exports for backward compatibility
export const ITEM_TO_CATEGORY_MAP = ALL_ITEMS_TO_CATEGORY;

// New suggested constant for tool categories
export const TOOL_CATEGORIES = [
  "Power Tools & Hand Tools",
  "Construction & Workshop Equipment",
  "Audio & Visual Equipment", 
  "Electronics & Computing",
  "Gardening Tools",
  "Camping & Outdoor Gear",
  "Measuring & Detection Tools",
  "Cleaning Equipment",
  "Lifting & Moving Tools",
  "Lighting & Photography",
  "Automotive Tools", 
  "Event & Entertainment Equipment",
  "Safety Equipment",
  "Specialty Tools",
  "Other"
];