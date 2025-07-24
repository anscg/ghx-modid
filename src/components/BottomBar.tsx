import React from "react";
import BottomBarButton from "./BottomBarButton";

// --- Dynamic Style Configuration ---
const height = 73; // The new height for the bar elements
const baseHeight = 73; // The reference height for scaling calculations
const scaleFactor = height / baseHeight;

// Dynamically calculated styles that scale with the height
const buttonContainerStyle: React.CSSProperties = {
  height: `${height}px`,
  borderRadius: `1000px`, // Perfectly rounded
  background: "linear-gradient(180deg, #FEFEFE 0%, #F2EEEB 100%)",
  boxShadow: `0 ${4 * scaleFactor}px ${30 * scaleFactor}px 0 rgba(0, 0, 0, 0.30), inset 0 ${-2 * scaleFactor}px ${2 * scaleFactor}px 0 rgba(0, 0, 0, 0.07)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

// --- Sub-components using the dynamic styles ---

const BookmarkButton: React.FC = () => (
  <BottomBarButton>
    <div
      style={{
        ...buttonContainerStyle,
        width: `${height}px`, // Make it a perfect circle
      }}
    >
      <img
        src="/bookmark.svg"
        alt="Bookmark"
        style={{
          width: `${30 * scaleFactor}px`, // Scaled icon size
          height: `${30 * scaleFactor}px`,
          opacity: 0.6,
        }}
      />
    </div>
  </BottomBarButton>
);

const SearchBar: React.FC = () => (
  <BottomBarButton style={{ flexGrow: 1, margin: "0 15px" }}>
    <div
      style={{
        ...buttonContainerStyle,
        padding: `0 ${25 * scaleFactor}px`,
        gap: `${12 * scaleFactor}px`,
      }}
    >
      <img
        src="/search.svg"
        alt="Search"
        style={{
          width: `${28 * scaleFactor}px`, // Scaled icon size
          height: `${28 * scaleFactor}px`,
          opacity: 0.6,
        }}
      />
      <span
        style={{
          fontSize: `${22 * scaleFactor}px`, // Scaled font size
          color: "rgba(0, 0, 0, 0.4)",
          fontWeight: 500,
        }}
      >
        想去邊度？
      </span>
    </div>
  </BottomBarButton>
);

const HomeButton: React.FC = () => (
  <BottomBarButton>
    <div
      style={{
        ...buttonContainerStyle,
        width: `${height}px`, // Make it a perfect circle
      }}
    >
      <img
        src="/home.svg"
        alt="Home"
        style={{
          width: `${32 * scaleFactor}px`, // Scaled icon size
          height: `${32 * scaleFactor}px`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: `-${3 * scaleFactor}px`, // Scaled position
          right: `-${3 * scaleFactor}px`,
          width: `${30 * scaleFactor}px`, // Scaled size
          height: `${30 * scaleFactor}px`,
          borderRadius: `1000px`,
          background: "#616161",
          boxShadow: `0 ${2 * scaleFactor}px ${4 * scaleFactor}px rgba(0,0,0,0.25)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/add.svg"
          alt="Add"
          style={{
            width: `${16 * scaleFactor}px`, // Scaled icon size
            height: `${16 * scaleFactor}px`,
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>
    </div>
  </BottomBarButton>
);

const BottomBar: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        // Increased bottom padding to give the taller bar more space
        padding: "0 20px 34px 20px",
        zIndex: 105,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <BookmarkButton />
      <SearchBar />
      <HomeButton />
    </div>
  );
};

export default BottomBar;
