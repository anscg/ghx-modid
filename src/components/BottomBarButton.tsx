import React from "react";
import { motion, Transition } from "motion/react";

interface BottomBarButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Animation is ~80% faster with higher stiffness.
const transition: Transition = {
  type: "spring",
  stiffness: 3000,
  damping: 40, // Increased damping to control the "bounce" of a stiffer spring
  mass: 1,
};

const BottomBarButton: React.FC<BottomBarButtonProps> = ({
  onClick,
  children,
  style,
  className,
}) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }} // A uniform scale prevents icon distortion
      transition={transition}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      className={className}
    >
      {children}
    </motion.button>
  );
};

export default BottomBarButton;
