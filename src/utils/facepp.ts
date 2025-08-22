import axios from "axios";

const API_KEY = "6KxriioDHyVjJL5tmzblw2ci_lfrjjDa";
const API_SECRET = "TEXQUjpzY6w6ZCq_poA-fjZsGTXrij-N";

export interface FaceDetectionResult {
  success: boolean;
  message: string;
  type: "success" | "warning" | "error";
  faces?: any[];
  details?: string;
}

export const detectFace = async (
  base64Image: string
): Promise<FaceDetectionResult> => {
  try {
    const response = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      new URLSearchParams({
        api_key: API_KEY,
        api_secret: API_SECRET,
        image_base64: base64Image,
        return_attributes: "blur,headpose,facequality",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    const data = response.data;

    if (!data.faces) {
      return {
        success: false,
        message: "No face detected",
        type: "error",
        details: "Please make sure your face is clearly visible in the photo.",
      };
    }

    if (data.faces.length === 0) {
      return {
        success: false,
        message: "No face detected",
        type: "error",
        details: "Please make sure your face is clearly visible and well-lit.",
      };
    }

    if (data.faces.length > 1) {
      return {
        success: false,
        message: "Multiple faces detected",
        type: "warning",
        details: `Found ${data.faces.length} faces. Please take a photo with only yourself visible.`,
      };
    }

    // Single face detected - let's validate quality
    const face = data.faces[0];
    const faceRect = face.face_rectangle;

    // Check if face is too small (less than 15% of image)
    // Assuming typical image dimensions, adjust as needed
    const faceArea = faceRect.width * faceRect.height;
    if (faceArea < 10000) {
      // Adjust threshold as needed
      return {
        success: false,
        message: "Face too small",
        type: "warning",
        details:
          "Please move closer to the camera so your face fills more of the frame.",
      };
    }

    // Check blur if available
    if (face.attributes?.blur) {
      const blurLevel = face.attributes.blur.blurriness;
      if (blurLevel > 50) {
        // Threshold for blur
        return {
          success: false,
          message: "Photo is blurry",
          type: "warning",
          details: "Please take a clearer photo. Hold the camera steady.",
        };
      }
    }

    // Check head pose if available
    if (face.attributes?.headpose) {
      const { yaw_angle, pitch_angle, roll_angle } = face.attributes.headpose;

      // Check if face is looking straight (allow some tolerance)
      if (Math.abs(yaw_angle) > 30 || Math.abs(pitch_angle) > 25) {
        return {
          success: false,
          message: "Face not looking forward",
          type: "warning",
          details:
            "Please look straight at the camera for the best profile photo.",
        };
      }
    }

    return {
      success: true,
      message: "Perfect photo!",
      type: "success",
      faces: data.faces,
      details:
        "Your face has been detected clearly. This photo is ready to use.",
    };
  } catch (error: any) {
    console.error("Face++ Error:", error.response?.data || error.message);

    if (error.code === "ECONNABORTED") {
      return {
        success: false,
        message: "Connection timeout",
        type: "error",
        details: "Please check your internet connection and try again.",
      };
    }

    return {
      success: false,
      message: "Detection failed",
      type: "error",
      details: "Unable to analyze the photo. Please try again.",
    };
  }
};
