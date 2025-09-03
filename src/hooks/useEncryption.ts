import CryptoJS from "crypto-js";
import { ENCRYPTION_KEY } from "@env";

export function useEncryption() {
  const encrypt = (plainText: string): string => {
    const iv = CryptoJS.lib.WordArray.random(16); // random IV
    const encrypted = CryptoJS.AES.encrypt(
      plainText,
      CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
      {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    return iv.toString(CryptoJS.enc.Base64) + ":" + encrypted.toString();
  };

  const decrypt = (cipherText: string): string => {
    const [ivBase64, encryptedData] = cipherText.split(":");
    const iv = CryptoJS.enc.Base64.parse(ivBase64);

    const decrypted = CryptoJS.AES.decrypt(
      encryptedData,
      CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
      {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  };

  return { encrypt, decrypt };
}
