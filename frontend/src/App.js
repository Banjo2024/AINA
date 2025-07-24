import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import FoodLoggerPage from "./pages/FoodLoggerPage";
import RecipesPage from "./pages/RecipesPage";
import TrendsPage from './pages/TrendsPage';
import Navbar from "./components/Navbar"; // Import the Navbar component

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/food-logger" element={<FoodLoggerPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/trends" element={<TrendsPage />} />

        {/* You can add more routes here, like Trends, Profile, etc. */}
      </Routes>
    </Router>
  );
}

export default App;
