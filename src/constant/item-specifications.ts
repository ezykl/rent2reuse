// Add this function to generate description templates
export const generateDescriptionTemplate = (
  itemName: string,
  category: string
): string => {
  // Specific item templates
  const specificTemplates: Record<string, string> = {
    "Cordless Drill": `Brand: 
Model: 
Voltage: 
Battery Type: 
Chuck Size: 
Max Torque: 
Speed Settings: 
Included: 

Additional Notes: `,

    "Circular Saw": `Brand: 
Model: 
Power: 
Blade Size: 
Max Cutting Depth: 
Power Source: 
Safety Features: 
Included: 

Additional Notes: `,

    "Angle Grinder": `Brand: 
Model: 
Power: 
Disc Size: 
Speed: 
Safety Features: 
Included: 

Additional Notes: `,

    "Welding Machine": `Brand: 
Model: 
Type: 
Current Range: 
Power Input: 
Duty Cycle: 
Included: 

Additional Notes: `,

    "DSLR Camera": `Brand: 
Model: 
Megapixels: 
Lens Mount: 
Video Recording: 
Battery Life: 
Included: 

Additional Notes: `,

    Projector: `Brand: 
Model: 
Resolution: 
Brightness (Lumens): 
Connectivity: 
Throw Distance: 
Included: 

Additional Notes: `,

    Generator: `Brand: 
Model: 
Power Output: 
Fuel Type: 
Runtime: 
Noise Level: 
Included: 

Additional Notes: `,
  };

  // Check for specific item first
  if (specificTemplates[itemName]) {
    return specificTemplates[itemName];
  }

  // Category-based templates (fallback)
  const categoryTemplates: Record<string, string> = {
    "Power Tools & Hand Tools": `Brand: 
Model: 
Power: 
Features: 
Included Accessories: 

Additional Notes: `,

    "Construction & Workshop Equipment": `Brand: 
Model: 
Capacity: 
Power Source: 
Specifications: 
Included: 

Additional Notes: `,

    "Audio & Visual Equipment": `Brand: 
Model: 
Type: 
Connectivity: 
Power Requirements: 
Included: 

Additional Notes: `,

    "Gardening Tools": `Brand: 
Model: 
Type: 
Power Source: 
Specifications: 
Included: 

Additional Notes: `,

    "Camping & Outdoor Gear": `Brand: 
Model: 
Capacity: 
Material: 
Weather Rating: 
Included: 

Additional Notes: `,

    "Measuring & Detection Tools": `Brand: 
Model: 
Measurement Type: 
Range: 
Accuracy: 
Power Source: 
Included: 

Additional Notes: `,

    "Cleaning Equipment": `Brand: 
Model: 
Type: 
Power: 
Capacity: 
Included: 

Additional Notes: `,

    "Automotive Tools": `Brand: 
Model: 
Type: 
Compatibility: 
Specifications: 
Included: 

Additional Notes: `,
  };

  // Return category template or generic template
  return (
    categoryTemplates[category] ||
    `Brand: 
Model: 
Type: 
Features: 
Specifications: 
Included: 

Additional Notes: `
  );
};
