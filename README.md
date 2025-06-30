# React + TypeScript + Vite + AWS Amplify UI

This project is a React application built with TypeScript, Vite, and AWS Amplify UI components. It features a weather widget at the top of the page that displays a horizontal forecast.

## Features

- **Weather Widget**: A horizontal weather widget at the top of the page that displays:
  - 7-day weather forecast
  - Weather emojis for each day
  - High/low temperatures
  - Date information
  - Auto-refreshes every 30 minutes

- **Emergency Alerts**: An emergency alerts card below the weather widget that displays:
  - Current emergency alert status for Ann Arbor, MI (48103)
  - Green background when no alerts are active
  - Red background when emergency alerts are present
  - Alert titles with appropriate emojis
  - Auto-refreshes every 5 minutes

- **Content Tabs**: A tabbed interface with seven main categories and URL routing:
  - 🎉 **Events**: Local events and activities with infinite scroll (`/events`)
    - Shows only events with images for better visual experience
    - Mobile-optimized card layout with prominent images
    - Today's events prioritized at the top
    - Organized information hierarchy for easy scanning
  - 🏠 **Housing**: Housing information and listings (`/housing`)
    - Real estate listings from Ann Arbor, MI area
    - Property details including price, bedrooms, bathrooms, square footage
    - Status indicators (NEW, PRICE REDUCED, SOLD, PENDING)
    - Mobile-optimized property cards with organized information
    - Auto-refreshes every 30 minutes
  - 🛍️ **For Sale**: Craigslist marketplace items (`/forsale`)
    - Local Craigslist listings from Ann Arbor area
    - Item details including price, location, category, and description
    - Free items highlighted with special badges
    - Category-based color coding for easy identification
    - Direct links to view items on Craigslist
    - Auto-refreshes every 30 minutes
  - 📰 **News**: Local news and updates (`/news`)
    - Local Ann Arbor news from MLive.com
    - Article headlines, summaries, and publication times
    - Author information and news source attribution
    - Featured images for articles when available
    - Direct links to read full articles
    - Auto-refreshes every 30 minutes
  - 🏛️ **Politics**: Political news and information (`/politics`)
  - 👥 **Social**: Social activities and community (`/social`)
    - Reddit posts from r/AnnArbor subreddit
    - Post details including score, comments, author, and timestamps
    - Post type indicators (text, link, image, poll)
    - Infinite scroll with 20 posts per page
    - Direct links to view posts on Reddit
    - Auto-refreshes with latest posts
  - 🎓 **Education**: Educational resources and information (`/education`)

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **AWS Amplify UI** - Component library
- **React Router** - Client-side routing for tab navigation
- **Weather API** - RSS feed from https://rss-feeds.jpc.io/api/weather
- **Real Estate API** - RSS feed from https://rss-feeds.jpc.io/api/realestate
- **Reddit API** - RSS feed from https://rss-feeds.jpc.io/api/reddit
- **News API** - RSS feed from https://rss-feeds.jpc.io/api/mlive
- **Craigslist API** - RSS feed from https://rss-feeds.jpc.io/api/craigslist

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Project Structure

```
src/
├── components/
│   ├── WeatherWidget.tsx        # Weather widget component
│   ├── EmergencyAlerts.tsx      # Emergency alerts component
│   ├── MainTabs.tsx             # Main tabs navigation component
│   ├── EventsTab.tsx            # Events tab content
│   ├── HousingTab.tsx           # Housing tab content
│   ├── ForSaleTab.tsx           # For Sale tab content
│   ├── NewsTab.tsx              # News tab content
│   ├── PoliticsTab.tsx          # Politics tab content
│   ├── SocialTab.tsx            # Social tab content
│   └── EducationTab.tsx         # Education tab content
├── App.tsx                      # Main app component
├── main.tsx                     # App entry point
└── ...
```

## Weather Widget

The weather widget fetches data from an RSS feed and parses the XML to extract:
- Daily weather forecasts
- Temperature highs and lows
- Weather condition emojis
- Date information

The widget is positioned as a sticky header at the top of the page and automatically refreshes every 30 minutes.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
