// src/components/Navbar.js

import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();
  return (
    <nav style={{
      background: "none",
      border: "none",
      margin: "30px auto 0 auto", // add margin-top for spacing
      display: "flex",
      justifyContent: "center"
    }}>
      <div style={{
        maxWidth: 550, // Match your dashboard/card width!
        width: "100%",
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 2px 16px #0001",
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        height: 62,
        gap: 30,
      }}>
        <Link to="/" style={{
          fontWeight: 800,
          fontSize: "2em",
          color: "#2285f6",
          textDecoration: "none",
          letterSpacing: 1,
          marginRight: 30,
        }}>
          AINA
        </Link>
        <Link to="/food-logger" style={navLinkStyle(location.pathname === "/food-logger")}>Log Food</Link>
        <Link to="/recipes" style={navLinkStyle(location.pathname === "/recipes")}>Recipes</Link>
        <Link to="/trends" style={navLinkStyle(location.pathname === "/trends")}>Trends</Link>
        <Link to="/profile" style={navLinkStyle(location.pathname === "/profile")}>Profile</Link>
      </div>
    </nav>
  );
}

function navLinkStyle(active) {
  return {
    textDecoration: "none",
    color: active ? "#222" : "#666",
    fontWeight: 600,
    fontSize: "1.15em",
    marginRight: 18,
    letterSpacing: "0.5px"
  };
}

export default Navbar;
