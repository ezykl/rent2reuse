import axios from "axios";
import { FACE_PLUS_PLUS_API_KEY, FACE_PLUS_PLUS_API_SECRET } from "@env";

const API_KEY = FACE_PLUS_PLUS_API_KEY;
const API_SECRET = FACE_PLUS_PLUS_API_SECRET;

export interface FaceDetectionResult {
  success: boolean;
  message: string;
  type: "success" | "warning" | "error";
  faces?: any[];
  details?: string;
  qualityScore?: number;
  suggestions?: string[];
  failureCount?: number;
}

export const detectFace = async (
  base64Image: string,
  failureCount: number = 0
): Promise<FaceDetectionResult> => {
  try {
    console.log("Starting face detection...");

    const response = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      new URLSearchParams({
        api_key: API_KEY,
        api_secret: API_SECRET,
        image_base64: base64Image,
        return_attributes: "blur,headpose,facequality,eyestatus,mouthstatus",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    console.log("Face++ API Response:", JSON.stringify(data, null, 2));

    if (!data.faces || data.faces.length === 0) {
      return {
        success: false,
        message: "No face detected",
        type: "error",
        details: "Please make sure your face is clearly visible and well-lit.",
        suggestions: [
          "Ensure good lighting on your face",
          "Move closer to the camera",
          "Remove any obstructions",
        ],
        failureCount: failureCount + 1,
      };
    }

    if (data.faces.length > 1) {
      return {
        success: false,
        message: "Multiple faces detected",
        type: "warning",
        details: `Found ${data.faces.length} faces. Please take a photo with only yourself visible.`,
        suggestions: [
          "Make sure you're alone in the frame",
          "Cover or remove other people from the background",
        ],
        failureCount: failureCount + 1,
      };
    }

    // Single face detected - validate quality
    const face = data.faces[0];
    const faceRect = face.face_rectangle;

    // Basic face size validation (more lenient)
    const faceArea = (faceRect?.width || 0) * (faceRect?.height || 0);
    console.log("Face area:", faceArea, "Face rect:", faceRect);

    // More lenient face size check
    if (faceArea < 5000) {
      return {
        success: false,
        message: "Face too small",
        type: "warning",
        details:
          "Please move closer to the camera so your face is more visible.",
        suggestions: ["Move closer to the camera"],
        failureCount: failureCount + 1,
      };
    }

    // Initialize all validation variables
    let hasBlurIssue = false;
    let hasPoseIssue = false;
    let poseMessage = "";
    let hasEyeIssue = false;
    let eyeMessage = "";
    let hasMouthIssue = false;
    let mouthMessage = "";

    // Check blur if available
    if (face.attributes?.blur?.blurriness) {
      const blurLevel = parseFloat(face.attributes.blur.blurriness) || 0;
      console.log("Blur level:", blurLevel);
      if (blurLevel > 70) {
        hasBlurIssue = true;
      }
    }

    // Check head pose - stricter for profile photos
    if (face.attributes?.headpose) {
      const { yaw_angle, pitch_angle, roll_angle } = face.attributes.headpose;
      const yaw = Math.abs(parseFloat(yaw_angle) || 0);
      const pitch = Math.abs(parseFloat(pitch_angle) || 0);
      const roll = Math.abs(parseFloat(roll_angle) || 0);

      console.log("Head pose - Yaw:", yaw, "Pitch:", pitch, "Roll:", roll);

      if (yaw > 20) {
        hasPoseIssue = true;
        poseMessage = "Please look straight at the camera";
      } else if (pitch > 15) {
        hasPoseIssue = true;
        poseMessage = "Keep your head level, not tilted up or down";
      } else if (roll > 10) {
        hasPoseIssue = true;
        poseMessage = "Don't tilt your head to the side";
      }
    }

    // Check eye status - both eyes must be open
    if (face.attributes?.eyestatus) {
      const leftEyeOpen =
        face.attributes.eyestatus.left_eye_status?.no_glass_eye_open > 0.7;
      const rightEyeOpen =
        face.attributes.eyestatus.right_eye_status?.no_glass_eye_open > 0.7;

      console.log(
        "Eye status - Left eye open:",
        leftEyeOpen,
        "Right eye open:",
        rightEyeOpen
      );
      console.log(
        "Left eye raw score:",
        face.attributes.eyestatus.left_eye_status?.no_glass_eye_open
      );
      console.log(
        "Right eye raw score:",
        face.attributes.eyestatus.right_eye_status?.no_glass_eye_open
      );

      if (!leftEyeOpen && !rightEyeOpen) {
        hasEyeIssue = true;
        eyeMessage = "Please open your eyes";
      } else if (!leftEyeOpen || !rightEyeOpen) {
        hasEyeIssue = true;
        eyeMessage = "Keep both eyes open";
      }
    }

    // Check mouth status - mouth should be closed
    if (face.attributes?.mouthstatus) {
      const mouthOpen = face.attributes.mouthstatus.open > 0.1;

      console.log(
        "Mouth status - Open:",
        mouthOpen,
        "Raw score:",
        face.attributes.mouthstatus.open
      );

      if (mouthOpen) {
        hasMouthIssue = true;
        mouthMessage = "Please close your mouth";
      }
    }

    // Calculate quality score (0-100)
    let qualityScore = 50; // Start with base score

    // Face size contribution (20 points max)
    if (faceArea > 15000) qualityScore += 20;
    else if (faceArea > 10000) qualityScore += 15;
    else if (faceArea > 7500) qualityScore += 10;
    else qualityScore += 5;

    // Blur contribution (20 points max)
    if (face.attributes?.blur?.blurriness) {
      const blurLevel = parseFloat(face.attributes.blur.blurriness) || 0;
      qualityScore += Math.max(0, 20 - blurLevel / 2.5);
    } else {
      qualityScore += 15;
    }

    // Pose contribution (25 points max)
    if (face.attributes?.headpose) {
      const yaw = Math.abs(parseFloat(face.attributes.headpose.yaw_angle) || 0);
      const pitch = Math.abs(
        parseFloat(face.attributes.headpose.pitch_angle) || 0
      );
      const roll = Math.abs(
        parseFloat(face.attributes.headpose.roll_angle) || 0
      );

      let poseScore = 25;
      poseScore -= Math.min(15, yaw * 0.75);
      poseScore -= Math.min(10, pitch * 0.5);
      poseScore -= Math.min(5, roll * 0.5);

      qualityScore += Math.max(0, poseScore);
    } else {
      qualityScore += 15;
    }

    // Eye status contribution (15 points max)
    if (face.attributes?.eyestatus) {
      const leftEyeOpen =
        face.attributes.eyestatus.left_eye_status?.no_glass_eye_open > 0.7;
      const rightEyeOpen =
        face.attributes.eyestatus.right_eye_status?.no_glass_eye_open > 0.7;

      if (leftEyeOpen && rightEyeOpen) {
        qualityScore += 15;
      } else if (leftEyeOpen || rightEyeOpen) {
        qualityScore += 5;
      }
    } else {
      qualityScore += 10;
    }

    // Mouth status contribution (20 points max)
    if (face.attributes?.mouthstatus) {
      const mouthOpen = face.attributes.mouthstatus.open > 0.3;

      if (!mouthOpen) {
        qualityScore += 20;
      } else {
        qualityScore += 5;
      }
    } else {
      qualityScore += 15;
    }

    // Ensure score is within bounds
    qualityScore = Math.min(100, Math.max(0, qualityScore));
    console.log("Calculated quality score:", qualityScore);

    // Collect all issues and suggestions
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (hasEyeIssue) {
      issues.push(eyeMessage);
      suggestions.push("Keep both eyes open and look at the camera");
    }

    if (hasMouthIssue) {
      issues.push(mouthMessage);
      suggestions.push("Close your mouth for a professional look");
    }

    if (hasPoseIssue) {
      issues.push(poseMessage);
      suggestions.push("Face the camera directly");
    }

    if (hasBlurIssue) {
      issues.push("Photo is blurry");
      suggestions.push("Hold the camera steady");
    }

    // Success criteria - all checks must pass
    if (
      !hasEyeIssue &&
      // !hasMouthIssue &&
      !hasPoseIssue &&
      !hasBlurIssue &&
      qualityScore >= 70
    ) {
      return {
        success: true,
        message: qualityScore > 90 ? "Perfect profile photo!" : "Great photo!",
        type: "success",
        faces: data.faces,
        details: `Excellent quality detected. Quality score: ${Math.round(
          qualityScore
        )}/100`,
        qualityScore: Math.round(qualityScore),
        suggestions: [
          "Your photo meets all requirements for a professional profile picture",
        ],
        failureCount: 0,
      };
    }

    // If we have issues, return the most important one
    const primaryIssue = issues[0] || "Photo needs improvement";
    const allSuggestions =
      suggestions.length > 0
        ? suggestions
        : ["Please adjust your photo and try again"];

    return {
      success: false,
      message: primaryIssue,
      type: "warning",
      details:
        issues.length > 1
          ? `Multiple issues: ${issues.join(", ")}`
          : `Quality score: ${Math.round(qualityScore)}/100`,
      qualityScore: Math.round(qualityScore),
      suggestions: allSuggestions,
      failureCount: failureCount + 1,
    };
  } catch (error: any) {
    console.log("Face++ Error:", error.response?.data || error.message);

    if (error.code === "ECONNABORTED") {
      return {
        success: false,
        message: "Connection timeout",
        type: "error",
        details: "Please check your internet connection and try again.",
        suggestions: [
          "Check your internet connection",
          "Try again in a moment",
        ],
        failureCount: failureCount + 1,
      };
    }

    // Handle API-specific errors
    if (error.response?.data?.error_message) {
      const errorMsg = error.response.data.error_message;
      console.log("Face++ API Error:", errorMsg);

      if (errorMsg.includes("INVALID_IMAGE")) {
        return {
          success: false,
          message: "Invalid image format",
          type: "error",
          details: "Please use a valid image format.",
          suggestions: ["Try taking a new photo"],
          failureCount: failureCount + 1,
        };
      }
    }

    return {
      success: false,
      message: "Detection failed",
      type: "error",
      details: "Unable to analyze the photo. Please try again.",
      suggestions: ["Try taking a new photo", "Ensure good lighting"],
      failureCount: failureCount + 1,
    };
  }
};

export interface FaceComparisonResult {
  success: boolean;
  confidence: number;
  message: string;
  details: string;
  type?: "success" | "warning" | "error";
}

export const compareFaces = async (
  image1Base64: string,
  image2Base64: string
): Promise<FaceComparisonResult> => {
  try {
    if (!image1Base64 || !image2Base64) {
      return {
        success: false,
        confidence: 0,
        message: "Missing image data",
        details: "Both images are required for comparison",
        type: "error",
      };
    }

    // Face++ Compare API endpoint
    const response = await fetch(
      "https://api-us.faceplusplus.com/facepp/v3/compare",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          api_key: FACE_PLUS_PLUS_API_KEY,
          api_secret: FACE_PLUS_PLUS_API_SECRET,
          image_base64_1: image1Base64,
          image_base64_2: image2Base64,
        }).toString(),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error_message) {
      return {
        success: false,
        confidence: 0,
        message: data.error_message || "Face comparison failed",
        details:
          data.error_message ||
          "Unable to compare faces. Please ensure both images contain clear faces.",
        type: "error",
      };
    }

    // Confidence threshold (0-100)
    // Face++ returns confidence as a percentage
    const CONFIDENCE_THRESHOLD = 65; // Adjust based on your security requirements
    const confidence = data.confidence || 0;

    if (confidence >= CONFIDENCE_THRESHOLD) {
      return {
        success: true,
        confidence,
        message: "✅ Faces Match!",
        details: `The faces match with ${confidence.toFixed(1)}% confidence.`,
        type: "success",
      };
    } else {
      return {
        success: false,
        confidence,
        message: "Faces Don't Match",
        details: "The profile image and ID don't appear to be the same person. Please retake your photos.",
        type: "warning",
      };
    }
  } catch (error) {
    console.error("Face comparison error:", error);
    return {
      success: false,
      confidence: 0,
      message: "❌ Comparison Error",
      details: "An error occurred while comparing faces. Please try again.",
      type: "error",
    };
  }
};
