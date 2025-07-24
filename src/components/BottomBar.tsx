import React, { useEffect, useState } from "react";
import BottomBarButton from "./BottomBarButton";
import { motion, AnimatePresence } from "motion/react";

// --- Dynamic Style Configuration (No changes here) ---
const baseHeight = 73;

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

const BottomBar: React.FC<{ followMode?: boolean }> = ({
  followMode = false,
}) => {
  const height = useResponsiveHeight();
  const scaleFactor = height / baseHeight;

  const buttonContainerStyle: React.CSSProperties = {
    height: `${height}px`,
    borderRadius: `1000px`,
    background: "linear-gradient(180deg, #FEFEFE 0%, #F2EEEB 100%)",
    boxShadow: `0 ${4 * scaleFactor}px ${30 * scaleFactor}px 0 rgba(0, 0, 0, 0.30), inset 0 ${-2 * scaleFactor}px ${2 * scaleFactor}px 0 rgba(0, 0, 0, 0.07)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    userSelect: "none",
  };

  // --- Sub-components (Unchanged) ---
  const BookmarkButton: React.FC = () => (
    <BottomBarButton>
      <div
        style={{
          ...buttonContainerStyle,
          width: `${height}px`,
        }}
      >
        <img
          src="/Bookmark.svg"
          alt="Bookmark"
          style={{
            width: `${25 * scaleFactor}px`,
            height: `${25 * scaleFactor}px`,
            opacity: 0.4,
          }}
        />
      </div>
    </BottomBarButton>
  );

  const SearchBar: React.FC = () => (
    <BottomBarButton
      style={{
        flexGrow: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          ...buttonContainerStyle,
          padding: `0 ${25 * scaleFactor}px`,
          gap: `${12 * scaleFactor}px`,
          overflow: "hidden",
        }}
      >
        <img
          src="/Search.svg"
          alt="Search"
          style={{
            width: `${16 * scaleFactor}px`,
            height: `${16 * scaleFactor}px`,
            opacity: 0.2,
          }}
        />
        <span
          style={{
            fontSize: `${18 * scaleFactor}px`,
            color: "#C0C0C5",
            letterSpacing: "-0.6px",
            fontWeight: 500,
            whiteSpace: "nowrap",
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
          width: `${height}px`,
        }}
      >
        <img
          src="/Home.svg"
          alt="Home"
          style={{
            width: `${25 * scaleFactor}px`,
            height: `${25 * scaleFactor}px`,
            opacity: 0.4,
          }}
        />
      </div>
    </BottomBarButton>
  );

  const springTransition = {
    type: "spring",
    stiffness: 400,
    damping: 35,
  };

  // --- The Fix ---
  // The rest of your component code (hooks, sub-components, etc.) is perfect and remains the same.

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: `0 25px calc(40px + env(safe-area-inset-bottom, 0)) 25px`,
        zIndex: 105,
        display: "flex",
        alignItems: "center",
        // gap: "15px", // <-- 1. REMOVE the gap property here
        userSelect: "none",
      }}
    >
      <AnimatePresence>
        {followMode && (
          <motion.div
            key="bookmark-button"
            // 3. ADD marginRight to the animation properties
            initial={{ opacity: 0, width: 0, marginRight: 0 }}
            animate={{ opacity: 1, width: height, marginRight: "15px" }}
            exit={{ opacity: 0, width: 0, marginRight: 0 }}
            transition={springTransition}
          >
            <BookmarkButton />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        transition={springTransition}
        style={{
          display: "flex",
          flexGrow: 1,
          minWidth: 0,
          marginRight: "15px", // <-- 2. ADD static margin for the gap before the next button
        }}
      >
        <SearchBar />
      </motion.div>

      <QuickButton />
    </div>
  );
};

export default BottomBar;
