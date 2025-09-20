  export default ({ config }) => ({
    name: 'Rent2Reuse',
    slug: 'rent2reuse',
    scheme: 'rent2reuse',
    userInterfaceStyle: 'automatic',
    orientation: 'portrait',
    icon: 'src/assets/images/logo-small.png',
    android: {
      package: 'com.zykdev.r2r',

      adaptiveIcon: {
        foregroundImage: 'src/assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: [
        'WRITE_EXTERNAL_STORAGE',
        'READ_EXTERNAL_STORAGE',
        'MEDIA_LIBRARY',
      ],
      googleServicesFile: "./google-services.json",
    },
    web: {
      output: 'static',
      bundler: 'metro',
    },
    plugins: [
      ['expo-router', { origin: 'https://n' }],
      ['@maplibre/maplibre-react-native', {
        mapLibreEnabled: true,
        androidMapLibreImpl: "maplibre"
      }],
      ['expo-camera', { cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera.' }],
      ['react-native-fast-tflite', { enableCoreMLDelegate: true }],
      [
        'expo-location',
        {
            "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to access your location while the app is in use.",
            "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location.",
            "isIosBackgroundLocationEnabled": false,  // Optional: Disable background location for iOS
            "isAndroidBackgroundLocationEnabled": false,  // Optional: Disable background location for Android
            "isAndroidForegroundServiceEnabled": true  // Enable foreground service (for Android)
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './src/assets/white-logo.png',
          resizeMode: 'contain',
          backgroundColor: '#4BD07F',
          imageWidth: 80,
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: "Allow Rent2Reuse to save payment receipts and other documents",
          savePhotosPermission: "Allow Rent2Reuse to save files to your device",
          isAccessMediaLocationEnabled: true
        }
      ],
     [
        "expo-file-system",
        {
          "requestPermissionsOnMount": true
        }
      ],
    ],
    newArchEnabled: true,
    extra: {
      router: {
        origin: 'https://n',
      },
      eas: {
        projectId: 'b6c06ef8-6e0a-4bb2-9f88-3283d3be41c1',
      },
    },
    owner: 'leikeze35',
  });
