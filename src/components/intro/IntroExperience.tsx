"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AnalysisWorkspace from "@/components/analysis/AnalysisWorkspace";
import styles from "./IntroExperience.module.css";

const INTRO_HOLD_MS = 2800;
const INTRO_EXIT_MS = 700;

export default function IntroExperience() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const hasLeft = useRef(false);

  const leave = useCallback(() => {
    if (hasLeft.current) return;
    hasLeft.current = true;
    setLeaving(true);
  }, []);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 1526, window.innerHeight / 900));
    resize();
    setReady(true);
    window.addEventListener("resize", resize);
    router.prefetch("/analysis");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(leave, reducedMotion ? 900 : INTRO_HOLD_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [leave, router]);

  useEffect(() => {
    if (!leaving) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => router.replace("/analysis"), reducedMotion ? 100 : INTRO_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, router]);

  return (
    <>
      <div className={`${styles.workspace} ${leaving ? styles.workspaceVisible : ""}`} inert aria-hidden="true">
        <AnalysisWorkspace preview />
      </div>
      <main className={`${styles.intro} ${leaving ? styles.leaving : ""}`} aria-label="노른자 인트로">
        <div
          className={`${styles.stage} ${ready ? styles.ready : ""}`}
          style={{ "--intro-scale": scale } as CSSProperties}
          role="img"
          aria-label="노른자 NORNZA"
        >
          <img src="/assets/intro-background.svg" width="1526" height="900" alt="" className={styles.background} fetchPriority="high" />
          <div className={styles.symbol} aria-hidden="true">
            <div className={`${styles.symbolPart} ${styles.leftPart}`}>
              <img src="/assets/intro-symbol.svg" width="199.191" height="199.228" alt="" fetchPriority="high" />
            </div>
            <div className={`${styles.symbolPart} ${styles.rightPart}`}>
              <img src="/assets/intro-symbol.svg" width="199.191" height="199.228" alt="" fetchPriority="high" />
            </div>
          </div>
          <div className={styles.wordmark} aria-hidden="true">
            <img src="/assets/intro-wordmark.svg" width="459.022" height="70.6368" alt="" fetchPriority="high" />
          </div>
        </div>
        <a href="/analysis" className={styles.skip} onClick={(event) => { event.preventDefault(); leave(); }}>
          건너뛰기 <span aria-hidden="true">↗</span>
        </a>
      </main>
    </>
  );
}
