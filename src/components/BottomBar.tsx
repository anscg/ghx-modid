import React, { useEffect, useState } from "react";
import BottomBarButton from "./BottomBarButton";

// --- Dynamic Style Configuration ---
const baseHeight = 73; // The reference height for scaling calculations

function useResponsiveHeight() {
  const [height, setHeight] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 400 ? window.innerWidth * 0.18 : 73;
    }
    return 73;
  });

  useEffect(() => {
    function handleResize() {
      setHeight(window.innerWidth < 400 ? window.innerWidth * 0.18 : 73);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return height;
}

const BottomBar: React.FC = () => {
  const height = useResponsiveHeight();
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
    userSelect: "none", // Prevent selection of icons and text in the button container
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
          src="/Bookmark.svg"
          alt="Bookmark"
          style={{
            width: `${25 * scaleFactor}px`, // Scaled icon size
            height: `${25 * scaleFactor}px`,
            opacity: 0.4,
          }}
        />
      </div>
    </BottomBarButton>
  );

  const SearchBar: React.FC = () => (
    <BottomBarButton style={{ flexGrow: 1, margin: "0 15px", minWidth: 0 }}>
      <div
        style={{
          ...buttonContainerStyle,
          padding: `0 ${25 * scaleFactor}px`,
          gap: `${12 * scaleFactor}px`,
          overflow: "visible", // Allow overflow if needed
        }}
      >
        <img
          src="/Search.svg"
          alt="Search"
          style={{
            width: `${16 * scaleFactor}px`, // Scaled icon size
            height: `${16 * scaleFactor}px`,
            opacity: 0.2,
          }}
        />
        <span
          style={{
            fontSize: `${18 * scaleFactor}px`, // Scaled font size
            color: "#C0C0C5",
            letterSpacing: "-0.6px",
            fontWeight: 500,
            whiteSpace: "nowrap", // Prevents wrapping
            overflow: "visible", // Allows overflow
            textOverflow: "clip", // No ellipsis, just clip if needed
            hyphens: "none", // Prevents hyphenation
            wordBreak: "keep-all", // Prevents breaking between words
            userSelect: "none", // Prevent selection of text
          }}
        >
          想去邊度？
        </span>
      </div>
    </BottomBarButton>
  );

  const QuickButton: React.FC = () => (
    <BottomBarButton>
      <div
        style={{
          ...buttonContainerStyle,
          width: `${height}px`, // Make it a perfect circle
        }}
      >
        <img
          src="/Home.svg"
          alt="Home"
          style={{
            width: `${25 * scaleFactor}px`, // Scaled icon size
            height: `${25 * scaleFactor}px`,
            opacity: 0.4,
          }}
        />
      </div>
    </BottomBarButton>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        // Increased bottom padding to give the taller bar more space, plus safe area inset for mobile browsers
        padding: `0 25px calc(40px + env(safe-area-inset-bottom, 0)) 25px`,
        zIndex: 105,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none", // Prevent selection in the whole bar
      }}
    >
      <BookmarkButton />
      <SearchBar />
      <QuickButton />
    </div>
  );
};

export default BottomBar;
