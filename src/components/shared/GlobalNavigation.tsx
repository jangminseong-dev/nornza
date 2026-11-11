"use client";

import Link from "next/link";
import styles from "./GlobalNavigation.module.css";

interface NavigationProps {
  active?: "analysis" | "report" | "history";
  onAnalysis?: () => void;
  onReport?: () => void;
  onHistory?: () => void;
}
export default function GlobalNavigation({ active = "analysis", onAnalysis, onReport, onHistory }: NavigationProps) {
  const items = [
    { id: "analysis", label: "입지분석", icon: active === "analysis" ? "icon-map.svg" : "icon-map-muted.svg", action: onAnalysis },
    { id: "report", label: "리포트", icon: active === "report" ? "icon-report-active.svg" : "icon-report.svg", action: onReport },
    { id: "history", label: "분석내역", icon: active === "history" ? "icon-history-active.svg" : "icon-history.svg", action: onHistory },
  ] as const;
  return <nav className={styles.navigation} aria-label="주 메뉴" data-no-print>
    <Link className={styles.brand} href="/" aria-label="노른자 처음으로">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/brand-symbol.svg" width={44} height={44} alt="" /><strong>노른자</strong>
    </Link>
    <div className={styles.items}>{items.map(item => <button key={item.id} type="button" onClick={item.action} disabled={!item.action} className={`${styles.item} ${active === item.id ? styles.active : ""}`} aria-current={active === item.id ? "page" : undefined}>
      <span className={styles.icon}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/assets/${item.icon}`} width={24} height={24} alt="" /></span>{item.label}
    </button>)}</div>
    <span className={styles.profile} title="데모 워크스페이스">서영</span>
  </nav>;
}
