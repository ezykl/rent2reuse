// On-device inference for the R2R item-classification model (v0.1).
// Replaces the old server call to R2R_MODEL (a dev-only LAN IP) — the
// model now ships inside the app bundle and runs locally via
// react-native-fast-tflite, so there's no network dependency and no
// hosting cost.
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode as decodeJpeg } from "jpeg-js";
import { toByteArray as base64ToByteArray } from "base64-js";
import {
  R2R_MODEL_INPUT_SIZE,
  R2RPrediction,
  interpretR2RPrediction,
} from "@/constant/r2rModel";

let modelPromise: Promise<TensorflowModel> | null = null;

function getModel(): Promise<TensorflowModel> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(
      require("@/assets/models/r2r_model.tflite")
    );
  }
  return modelPromise;
}

/**
 * Resizes the captured photo to the model's expected 224x224 input and
 * decodes it into a normalized (0-1) RGB Float32Array — there's no direct
 * "give me raw pixels" API for a static image in Expo/RN, so this goes
 * through a small resized JPEG as an intermediate step: resize with
 * expo-image-manipulator (already a dependency), decode that JPEG into raw
 * RGBA bytes with jpeg-js, then drop the alpha channel and normalize.
 */
async function preprocessImage(imageUri: string): Promise<Float32Array> {
  const resized = await manipulateAsync(
    imageUri,
    [{ resize: { width: R2R_MODEL_INPUT_SIZE, height: R2R_MODEL_INPUT_SIZE } }],
    { base64: true, format: SaveFormat.JPEG }
  );

  if (!resized.base64) {
    throw new Error("Failed to encode resized image as base64");
  }

  const jpegBytes = base64ToByteArray(resized.base64);
  const { data, width, height } = decodeJpeg(jpegBytes, { useTArray: true });

  if (width !== R2R_MODEL_INPUT_SIZE || height !== R2R_MODEL_INPUT_SIZE) {
    throw new Error(
      `Unexpected decoded image size ${width}x${height}, expected ${R2R_MODEL_INPUT_SIZE}x${R2R_MODEL_INPUT_SIZE}`
    );
  }

  // jpeg-js decodes to interleaved RGBA; the model expects RGB only,
  // normalized 0-1 (matching the original PIL `np.array(img) / 255.0`).
  const pixelCount = width * height;
  const rgb = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    rgb[i * 3] = data[i * 4] / 255;
    rgb[i * 3 + 1] = data[i * 4 + 1] / 255;
    rgb[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return rgb;
}

/**
 * Classifies a captured/picked photo entirely on-device. Returns the same
 * shape the old Flask API returned (see interpretR2RPrediction), so callers
 * that already handle that shape don't need to change.
 */
export async function classifyImageOnDevice(
  imageUri: string
): Promise<R2RPrediction[]> {
  const [model, input] = await Promise.all([
    getModel(),
    preprocessImage(imageUri),
  ]);

  const outputs = await model.run([input]);
  const probabilities = outputs[0] as Float32Array;
  return interpretR2RPrediction(probabilities);
}
