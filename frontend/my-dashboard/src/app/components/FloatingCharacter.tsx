"use client";

import Image from "next/image";
import { motion, useAnimation } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

interface FloatingCharacterProps {
  progress: number; // 0~100
}

const SPRITE_VARIANTS = [
  { max: 25, src: "/images/idle.png" },
  { max: 75, src: "/images/good.png" },
  { max: 101, src: "/images/success.png" },
];

const FloatingCharacter: React.FC<FloatingCharacterProps> = ({ progress }) => {
  const controls = useAnimation();
  const [sprite, setSprite] = useState("/images/good.png");

  const resolvedSprite = useMemo(() => {
    const variant = SPRITE_VARIANTS.find((entry) => progress < entry.max);
    return variant?.src ?? "/images/good.png";
  }, [progress]);

  useEffect(() => {
    setSprite(resolvedSprite);
  }, [resolvedSprite]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let running = true;

    const roam = async () => {
      while (running) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.random() * vw - vw / 2;
        const y = Math.random() * vh - vh / 2;
        const rot = Math.random() * 30 - 15;
        const scale = 0.9 + Math.random() * 0.2;
        await controls.start({
          x,
          y,
          rotate: rot,
          scale,
          transition: {
            duration: 2.5 + Math.random() * 1.2, // 느리게 (2.5~3.7s)
            ease: "easeInOut",
          },
        });
      }
    };

    roam();
    return () => {
      running = false;
    };
  }, [controls]);

  return (
    <motion.div
      animate={controls}
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      style={{ zIndex: 0, opacity: 0.9 }}
    >
      <Image
        src={sprite}
        alt="Cherry Evolution"
        width={180}
        height={180}
        className="drop-shadow-[0_0_25px_rgba(0,255,255,0.4)] transition-transform duration-500 ease-in-out"
        priority
      />
    </motion.div>
  );
};

export default FloatingCharacter;
