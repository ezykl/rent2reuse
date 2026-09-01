// On-device R2R item-classification model (v0.1) — ported from
// https://github.com/ezykl/r2r-model (app.py / classes.md). The order of
// R2R_MODEL_CLASSES matches the model's output tensor indices exactly; do
// not reorder or alphabetize this list, unlike the display-oriented
// TOOL_TO_CATEGORY map in tool-categories.ts.
//
// The model file itself lives at src/assets/models/r2r_model.tflite — a
// float16-quantized conversion of the original Keras model, validated to
// match the original's top-1 predictions on real photographic input before
// being bundled here (see AGENTS.md / plan history for the conversion
// process). react-native-fast-tflite loads it via
// loadTensorflowModel(require("@/assets/models/r2r_model.tflite")).

export const ACTIVE_MODEL = {
  id: "v0.1",
  name: "R2R Classifier v0.1",
  type: "on-device" as const,
};

export const R2R_MODEL_INPUT_SIZE = 224;

// Index order matches the model's 180-class output tensor exactly.
export const R2R_MODEL_CLASSES: readonly string[] = [
  "Action Camera",
  "Adjustable Wrench",
  "Air Compressor",
  "Air Mover",
  "Angle Grinder",
  "Audio Mixer",
  "Axe",
  "Ball",
  "Belt Sander",
  "Bench Grinder",
  "Beverages",
  "Bike & E-Bike",
  "Book",
  "Boom Microphone",
  "Bounce House",
  "Brad Nailer",
  "Butane & LPG",
  "Camera Tripod",
  "Camping Cot",
  "Camping Tent",
  "Canned & Packaged Food",
  "Car Battery Charger",
  "Car Jack",
  "Car Polisher",
  "Caulking Gun",
  "Chainsaw",
  "Circular Saw",
  "Clamp Meter",
  "Claw Hammer",
  "Combination Square",
  "Combination Wrench Set",
  "Concrete Mixer",
  "Concrete Saw",
  "Cordless Drill",
  "Cosmetics Products",
  "Crimping Tool",
  "Crowbar",
  "DJ Controller",
  "DSLR camera",
  "Drain Auger",
  "Drone",
  "Drywall Screw Gun",
  "Drywall Trowel",
  "Dust Extractor",
  "Earth Auger",
  "Electric Hoist",
  "Electric Planer",
  "Electric ScrewDriver",
  "Engine Hoist",
  "Everyday Clothing",
  "Explosive",
  "Extension Cord Reel",
  "Extension Ladder",
  "Finishing Nailer",
  "Firearms",
  "Flathead Screwdriver Set",
  "Floor Polisher",
  "Floor Scraper",
  "Folding Camping Chair",
  "Folding Chairs",
  "Folding Tables",
  "Fresh & Frozen Food",
  "Gambling Items",
  "Garden Rake",
  "Garden Tiller",
  "Gimbal Stabilizer",
  "Hacksaw",
  "Hammer Drill",
  "Hand Saw",
  "Hand Truck",
  "Hand-to-Hand Combat Weapon",
  "Hard Hat",
  "Hazardous Waste",
  "Headphone",
  "Heat Gun",
  "Heavy-Duty Fan",
  "Hedge Trimmer",
  "Hoe",
  "Houses & Apartments",
  "Identity documents",
  "Impact Wrench",
  "Infrared Thermometer",
  "Jack Stands",
  "Jackhammer",
  "Jewelry & Personal Accessories",
  "Jigsaw",
  "Ladder",
  "Laptop",
  "Laser Level",
  "Lavalier Microphone",
  "Lawn Mower",
  "Leaf Blower",
  "Lighter",
  "Livestock",
  "Loppers",
  "Medical Textiles Product",
  "Metal Detector",
  "Metal Shears",
  "Microphone Stand",
  "Money",
  "Monitor",
  "Motorbike & Scooter",
  "Mouthguards",
  "Multimeter",
  "Needle Nose Pliers",
  "Office Space",
  "Oral Care Products",
  "PEX Crimping Tool",
  "PVC Cutter",
  "Pet",
  "Phillips Screwdriver Set",
  "Pickaxe",
  "Pickup Truck",
  "Pipe Threader",
  "Pipe Wrench",
  "Pop-up Canopy Tent",
  "Portable Camping Stove",
  "Portable Cooler",
  "Portable Generator",
  "Portable Green Screen",
  "Post Hole Digger",
  "Power Trowel",
  "Prescription Drugs & Medicine",
  "Pressure Washer",
  "Projector",
  "Projector Screen",
  "Prosthetic Equipments",
  "Putty Knife",
  "Rebar Cutter",
  "Rental Car",
  "Ring Light",
  "Router Tool",
  "Rubber Mallet",
  "Scaffold Tower",
  "Scissor",
  "Served Food",
  "Shoes & Footwear",
  "Shop Vacuum",
  "Shovel",
  "Sledgehammer",
  "Sleeping Bag",
  "Slip Joint Pliers",
  "Socket Wrench Set",
  "Socks & Hosiery",
  "Sound System",
  "Spirit Level",
  "Steam Cleaner",
  "Storage Unit & Locker",
  "String Trimmer",
  "Stroller",
  "Studio Softbox Kit",
  "Syringes & Needles",
  "Tape Measure",
  "Thermal Camera",
  "Tin Snips",
  "Tire Inflator",
  "Tool Box",
  "Tool Chest",
  "Torque Wrench",
  "Torx Screwdriver Set",
  "Towels & Bathrobes",
  "Undergarments",
  "Utility Knife",
  "Vacuum Cleaner",
  "Vise Grip",
  "Voltage Tester",
  "Wallpaper Steamer",
  "Water Pump",
  "Welding Clamps",
  "Welding Helmet",
  "Welding Machine",
  "Welding Table",
  "Wet Tile Saw",
  "Wire Strippers",
  "Wire Tracer",
  "Wireless Microphone Kit",
  "Wireless Speaker",
  "Wood Carving Kit",
  "Wood Hand Planer",
  "Work Light",
];

export const R2R_PROHIBITED_CLASSES: ReadonlySet<string> = new Set([
  "Beverages",
  "Bike & E-Bike",
  "Butane & LPG",
  "Canned & Packaged Food",
  "Cosmetics Products",
  "Everyday Clothing",
  "Explosive",
  "Firearms",
  "Fresh & Frozen Food",
  "Gambling Items",
  "Hand-to-Hand Combat Weapon",
  "Hazardous Waste",
  "Houses & Apartments",
  "Identity documents",
  "Jewelry & Personal Accessories",
  "Lighter",
  "Livestock",
  "Medical Textiles Product",
  "Money",
  "Motorbike & Scooter",
  "Mouthguards",
  "Office Space",
  "Oral Care Products",
  "Pet",
  "Pickup Truck",
  "Prescription Drugs & Medicine",
  "Prosthetic Equipments",
  "Rental Car",
  "Served Food",
  "Shoes & Footwear",
  "Socks & Hosiery",
  "Storage Unit & Locker",
  "Syringes & Needles",
  "Towels & Bathrobes",
  "Undergarments",
]);

export interface R2RPrediction {
  label: string;
  category: "Accepted" | "Prohibited" | "N/A";
  probability: number; // 0-1
}

/**
 * Mirrors the confidence-threshold behavior of the original Flask API
 * (app.py): >=70% returns just the top-1 prediction, 20-70% returns the
 * top-3, and <20% returns a single "Unknown" result.
 */
export function interpretR2RPrediction(
  probabilities: ArrayLike<number>
): R2RPrediction[] {
  const indexed = Array.from(probabilities, (p, i) => ({ p, i }));
  indexed.sort((a, b) => b.p - a.p);

  const top = indexed[0];
  if (!top || top.p < 0.2) {
    return [{ label: "Unknown", category: "N/A", probability: top?.p ?? 0 }];
  }

  const toPrediction = ({ p, i }: { p: number; i: number }): R2RPrediction => {
    const label = R2R_MODEL_CLASSES[i] ?? "Unknown";
    return {
      label,
      category: R2R_PROHIBITED_CLASSES.has(label) ? "Prohibited" : "Accepted",
      probability: p,
    };
  };

  if (top.p >= 0.7) {
    return [toPrediction(top)];
  }

  return indexed.slice(0, 3).map(toPrediction);
}
