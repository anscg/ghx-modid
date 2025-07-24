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

const BottomBar: React.FC<{
  followMode?: boolean;
  addressZh?: string | null;
}> = ({ followMode = false, addressZh = "" }) => {
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

  const SearchBar: React.FC<{
    followMode: boolean;
    addressZh?: string | null;
  }> = ({ followMode, addressZh = "" }) => (
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
          display: "flex",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {followMode ? (
          <>
            <motion.img
              key="search-icon"
              src="/Search.svg"
              alt="Search"
              style={{
                width: `${16 * scaleFactor}px`,
                height: `${16 * scaleFactor}px`,
                opacity: 0.2,
                flexShrink: 0,
              }}
              initial={false}
              animate={{ opacity: 0.2 }}
              transition={{ duration: 0.3 }}
            />
            <motion.span
              key="search-text"
              style={{
                fontSize: `${18 * scaleFactor}px`,
                color: "#C0C0C5",
                letterSpacing: "-0.6px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                marginLeft: `${0 * scaleFactor}px`,
                flexShrink: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              想去邊度？
            </motion.span>
          </>
        ) : (
          <motion.div
            key="address-display"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingLeft: `${6 * scaleFactor}px`,
              minWidth: 0,
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: `${13 * scaleFactor}px`,
                color: "#C0C0C5",
                fontWeight: 500,
                marginBottom: `${-1 * scaleFactor}px`,
                letterSpacing: "-0.6px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              鄰近
            </span>
            <span
              style={{
                fontSize: `${20 * scaleFactor}px`,
                color: "#5F5F5F",
                fontWeight: 500,
                letterSpacing: "-0.6px",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
                maxWidth: "100%",
                minWidth: 0,
              }}
              title={addressZh || ""}
            >
              {addressZh || ""}
            </span>
          </motion.div>
        )}
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

  // Fix: Use correct type for Framer Motion's transition property
  const springTransition = {
    type: "spring" as const,
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
        userSelect: "none",
      }}
    >
      <AnimatePresence>
        {followMode && (
          <motion.div
            key="bookmark-button"
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
          marginRight: "15px",
          alignItems: "center",
        }}
      >
        <SearchBar followMode={!!followMode} addressZh={addressZh} />
      </motion.div>

      <QuickButton />
    </div>
  );
};

export default BottomBar;
