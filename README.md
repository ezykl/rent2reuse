# Rent2Reuse

Rent2Reuse is a modern mobile marketplace application that enables users to rent and lend items within their community. The platform facilitates peer-to-peer rental transactions, making it easy to monetize underutilized items while providing affordable access to needed items.

## 🌟 Features

- **Smart Item Listings**: Create and manage rental listings with detailed specifications, images, and location information
- **Real-time Chat**: Built-in messaging system for seamless communication between renters and lenders
- **Secure Payments**: Integrated payment processing with PayPal for secure transactions
- **Location Services**: Find items near you with distance calculations and map integration
- **Smart Notifications**: Real-time updates for rental requests, chat messages, and transaction status
- **Request Management**: Streamlined rental request system with status tracking
- **Image Handling**: Multi-image support with preview and fullscreen viewing capabilities
- **User Profiles**: Detailed user profiles with ratings and transaction history

## 🛠 Tech Stack

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![NativeWind](https://img.shields.io/badge/NativeWind-0284C7?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

### Frontend

- **React Native/Expo**: Core framework for cross-platform mobile development
- **Expo Router**: File-based routing system
- **NativeWind/Tailwind CSS**: Utility-first styling
- **Lottie**: Smooth animations and loading states
- **MapLibre**: Interactive maps and location features
- **MapTiler**: Map tiles and geocoding services

### Backend Services

- **Firebase**
  - Firestore: Database and real-time data sync
  - Storage: Image and media storage
  - Authentication: User management

### Key Libraries

- **Expo Location**: Geolocation services
- **OpenCage**: Address lookup and geocoding
- **Face++**: Image analysis for content moderation
- **OCR Space**: Text extraction from images
- **Frankfurter**: Currency exchange rates and conversions from European Central Bank
- **react-native-ui-datepicker**: Date and time selection
- **string-similarity**: AI-powered title validation
- **PayPal Integration**: Payment processing

## 🚀 Getting Started

### Prerequisites

- Node.js
- Expo CLI
- Firebase account
- PayPal developer account

### Installation

1. Clone the repository:

```sh
git clone https://github.com/ezykl/rent2reuse.git
```

2. Install dependencies:

```sh
cd rent2reuse
npm install
```

3. Configure environment variables:

   - Set up Firebase credentials
   - Configure PayPal integration
   - Set up other necessary API keys

4. Start the development server:

```sh
npx expo start
```

## 📱 App Structure

The application follows a modular architecture with:

- `/src/app`: Screen components and routing
- `/src/components`: Reusable UI components
- `/src/services`: API and service integrations
- `/src/hooks`: Custom React hooks
- `/src/context`: Global state management
- `/src/utils`: Helper functions and utilities

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests.
