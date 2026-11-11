"use client";

import type { AnalysisSelection } from "@/types/analysis";
import type { AddonId, DemoCandidate, DemoSettings } from "@/types/demo";
import styles from "./ConditionsView.module.css";

interface ConditionsViewProps {
  selection: AnalysisSelection;
  candidates: DemoCandidate[];
  settings: DemoSettings;
  onChange: (settings: DemoSettings) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const PURPOSES = ["신규 입점", "기존 매장 이전", "경쟁지역 비교", "신규 상권 탐색"];
const CUSTOMER_OPTIONS = ["직장인", "20대", "30대"];
const ADDONS: { id: AddonId; label: string; price: number }[] = [
  { id: "competitor", label: "경쟁 브랜드 심층 분석", price: 10_000 },
  { id: "night", label: "야간 활성도 상세 분석", price: 10_000 },
  { id: "accessibility", label: "도보 접근성 상세 분석", price: 10_000 },
  { id: "candidateComparison", label: "후보 그리드별 비교 분석", price: 20_000 },
];
const numberFormatter = new Intl.NumberFormat("ko-KR");

export default function ConditionsView({ selection, candidates, settings, onChange, onBack, onSubmit }: ConditionsViewProps) {
  const additionalCost = ADDONS.reduce((total, addon) => total + (settings.addons.includes(addon.id) ? addon.price : 0), 0);
  const customers = [...new Set([...CUSTOMER_OPTIONS, ...settings.targetCustomers])];
  const changeField = <Key extends keyof DemoSettings>(field: Key, value: DemoSettings[Key]) => {
    onChange({ ...settings, [field]: value });
  };
  const toggleAddon = (id: AddonId) => {
    changeField("addons", settings.addons.includes(id)
      ? settings.addons.filter((addon) => addon !== id)
      : [...settings.addons, id]);
  };
  const toggleCustomer = (customer: string) => {
    changeField("targetCustomers", settings.targetCustomers.includes(customer)
      ? settings.targetCustomers.filter((value) => value !== customer)
      : [...settings.targetCustomers, customer]);
  };

  return (
    <main className={styles.main} data-demo-view="conditions">
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}>
          <button type="button" onClick={onBack}>← 후보 그리드</button>
          <span aria-hidden="true">/</span>
          <span>03 분석 조건 설정</span>
        </div>
        <p className={styles.workspaceLabel}><span className={styles.demoBadge}>데모</span>입지전략팀 <span aria-hidden="true">·</span> Professional</p>
      </header>

      <div className={styles.content}>
        <div className={styles.heading}>
          <h1>분석 조건을 설정해주세요</h1>
          <p>분석 목적과 추가 옵션을 확인한 뒤 요청해주세요.</p>
        </div>

        <section className={styles.areaSummary} aria-label="선택한 분석 영역 요약">
          <h2>{selection.address ?? "선택한 분석 영역"}</h2>
          <p>{selection.areaSquareMeters == null ? "—" : `${numberFormatter.format(selection.areaSquareMeters)}㎡`}</p>
          <p>후보 그리드 {candidates.length}개</p>
        </section>

        <form className={styles.columns} onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <div className={styles.requestForm}>
            <div className={styles.formBody}>
              <fieldset className={styles.purposeSection}>
                <legend>분석 목적</legend>
                <div className={styles.purposeOptions}>
                  {PURPOSES.map((purpose) => (
                    <label key={purpose} className={styles.radioOption}>
                      <input type="radio" name="analysis-purpose" value={purpose} checked={settings.purpose === purpose} onChange={() => changeField("purpose", purpose)} />
                      <span>{purpose}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={styles.fieldRow}>
                <span>업종</span>
                <input value={settings.industry} onChange={(event) => changeField("industry", event.target.value)} maxLength={40} required />
              </label>
              <label className={styles.fieldRow}>
                <span>목표 월매출</span>
                <input value={settings.targetMonthlySales} onChange={(event) => changeField("targetMonthlySales", event.target.value)} maxLength={40} required />
              </label>
              <label className={styles.fieldRow}>
                <span>점포 형태</span>
                <input value={settings.storeType} onChange={(event) => changeField("storeType", event.target.value)} maxLength={40} required />
              </label>

              <div className={styles.customerRow}>
                <span id="target-customers-label">타깃 고객</span>
                <div className={styles.customerChips} role="group" aria-labelledby="target-customers-label">
                  {customers.map((customer) => (
                    <button key={customer} type="button" className={settings.targetCustomers.includes(customer) ? styles.selectedChip : styles.customerChip} aria-pressed={settings.targetCustomers.includes(customer)} onClick={() => toggleCustomer(customer)}>{customer}</button>
                  ))}
                </div>
              </div>

              <label className={styles.notes}>
                <span>요청사항</span>
                <textarea value={settings.notes} onChange={(event) => changeField("notes", event.target.value)} maxLength={1000} placeholder="분석 시 살펴볼 내용을 알려주세요." />
              </label>
            </div>
            <button className={styles.backButton} type="button" onClick={onBack}>← 이전</button>
          </div>

          <aside className={styles.addonCard} aria-labelledby="addon-heading">
            <h2 id="addon-heading">추가 분석 옵션</h2>
            <div className={styles.addonOptions}>
              {ADDONS.map((addon) => (
                <label key={addon.id} className={styles.addonOption}>
                  <input type="checkbox" checked={settings.addons.includes(addon.id)} onChange={() => toggleAddon(addon.id)} />
                  <span className={styles.addonCopy}><span>{addon.label}</span><small>+{numberFormatter.format(addon.price)}원</small></span>
                </label>
              ))}
            </div>

            <div className={styles.requestSummary}>
              <h3>이번 요청 요약</h3>
              <dl>
                <div><dt>기본 분석</dt><dd>월 제공 분석 1회</dd></div>
                <div><dt>추가 비용</dt><dd className={styles.price} aria-live="polite">{numberFormatter.format(additionalCost)}원</dd></div>
              </dl>
            </div>

            <div className={styles.submitArea}>
              <button className={styles.submitButton} type="submit">{numberFormatter.format(additionalCost)}원 · 분석 요청하기 <span aria-hidden="true">→</span></button>
              <p className={styles.demoNotice}>가상 결제 · 실제 결제나 분석 요청은 발생하지 않아요.</p>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
