import React, { useEffect, useState } from "react";
import BottomBarButton from "./BottomBarButton";
import { motion, AnimatePresence } from "motion/react";

// --- Dynamic Style & Scaling Logic (No changes here) ---
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

const BookmarkButton: React.FC<{
  buttonContainerStyle: React.CSSProperties;
  height: number;
  scaleFactor: number;
}> = ({ buttonContainerStyle, height, scaleFactor }) => (
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
  buttonContainerStyle: React.CSSProperties;
  scaleFactor: number;
}> = ({ followMode, addressZh = "", buttonContainerStyle, scaleFactor }) => (
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
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        justifyContent: "flex-start",
      }}
    >
      <AnimatePresence mode="wait">
        {followMode ? (
          <motion.div
            key="search-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${12 * scaleFactor}px`,
              minWidth: 0,
            }}
          >
            <img
              src="/Search.svg"
              alt="Search"
              style={{
                width: `${16 * scaleFactor}px`,
                height: `${16 * scaleFactor}px`,
                opacity: 0.2,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: `${18 * scaleFactor}px`,
                color: "#C0C0C5",
                letterSpacing: "-0.6px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              想去邊度？
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="address-display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
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
              }}
              title={addressZh || ""}
            >
              {addressZh || ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </BottomBarButton>
);

const QuickButton: React.FC<{
  buttonContainerStyle: React.CSSProperties;
  height: number;
  scaleFactor: number;
}> = ({ buttonContainerStyle, height, scaleFactor }) => (
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

// --- MAIN COMPONENT ---
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

  const springTransition = {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
  };

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
            {/* Pass props down to the stable component */}
            <BookmarkButton
              buttonContainerStyle={buttonContainerStyle}
              height={height}
              scaleFactor={scaleFactor}
            />
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
        {/* Pass props down to the stable component */}
        <SearchBar
          followMode={!!followMode}
          addressZh={addressZh}
          buttonContainerStyle={buttonContainerStyle}
          scaleFactor={scaleFactor}
        />
      </motion.div>

      {/* Pass props down to the stable component */}
      <QuickButton
        buttonContainerStyle={buttonContainerStyle}
        height={height}
        scaleFactor={scaleFactor}
      />
    </div>
  );
};

export default BottomBar;
