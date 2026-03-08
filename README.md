# UsharalTaxi - Community-Driven Ride-Hailing Solution

A specialized mobile application designed to modernize and streamline taxi services in the town of **Usharal, Kazakhstan**. This project provides a localized alternative to global platforms, tailored to the specific infrastructure and needs of the local community.

## 🎯 Project Vision
The main goal was to solve the "local transit gap" by creating a reliable bridge between independent drivers and passengers in a region where mainstream services like Uber or Yandex often lack full coverage.

## 🚀 Key Features

### 📍 Precise Location Services
*   **Real-time Tracking:** Integrated maps to show the current location of available taxis.
*   **Localized Geocoding:** Optimization for local landmarks and addresses specific to Usharal.

### 🚕 Driver & Passenger Flow
*   **One-Tap Requests:** Simplified booking process for quick ride hailing.
*   **Call Integration:** Direct "Call to Driver" functionality for instant communication.
*   **Fare Estimation:** Transparent pricing logic based on local distance-rate standards.

### 💼 Order Management
*   **Live Dashboard:** Real-time updates on order status (Pending, Accepted, Completed).
*   **History & Profile:** Users can track their previous rides and manage their personal data.

### 🌓 Modern UI/UX
*   **Deep Dark Interface:** Optimized for low-light conditions (perfect for night shifts).
*   **Performance:** Lightweight build ensures the app runs smoothly even on mid-range Android devices common in the region.

## 🛠 Tech Stack

*   **Frontend:** React Native (Expo), TypeScript.
*   **Navigation:** Expo Router.
*   **Backend:** Supabase (Auth, PostgreSQL, Real-time).
*   **Maps:** Integrated Google Maps / Expo Location API.
*   **UI Components:** React Native Elements, Custom Styled Components.

## 📂 Architecture

```text
UsharalTaxi/
├── app/            # File-based routing (Client & Driver flows)
├── components/     # Reusable UI elements (Map wrappers, Order cards)
├── lib/            # API clients, Supabase config, and Map helpers
└── assets/         # Optimized local assets and icons
```

## ⚙️ Setup & Running

1. Clone the repo:
   ```bash
   git clone https://github.com/altynbek8/UsharalTaxi.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   *Create a `.env` file with your Supabase credentials.*
4. Launch:
   ```bash
   npx expo start
   ```

---

## 👨‍💻 Developed by
**Altynbek Temirkhan**  
Junior Full Stack Engineer | React Native Developer  
