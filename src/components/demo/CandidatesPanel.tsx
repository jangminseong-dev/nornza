"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { AnalysisSelection } from "@/types/analysis";
import type { CandidateInput, DemoCandidate } from "@/types/demo";
import styles from "./CandidatesPanel.module.css";

interface CandidatesPanelProps {
  selection: AnalysisSelection;
  candidates: DemoCandidate[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (input: CandidateInput) => void;
  onUpdate: (id: string, input: CandidateInput) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

export default function CandidatesPanel({
  selection, candidates, activeId, onSelect, onAdd, onUpdate, onRemove, onBack, onNext,
}: CandidatesPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState({ name: "", address: "", floor: "1", areaPyeong: "30" });
  const [formError, setFormError] = useState("");
  const atLimit = candidates.length >= 5;
  const area = selection.areaSquareMeters === null ? "—" : numberFormatter.format(selection.areaSquareMeters);

  function openEditor(candidate?: DemoCandidate) {
    if (!candidate && atLimit) return;
    const usedLabels = new Set(candidates.map((item) => item.label));
    const nextLabel = ["A", "B", "C", "D", "E"].find((label) => !usedLabels.has(label)) ?? "";
    setEditingId(candidate?.id ?? null);
    setFields({
      name: candidate?.name ?? `후보 점포 ${nextLabel}`,
      address: candidate?.address ?? selection.address?.replace(/\s인근$/, "") ?? "",
      floor: String(candidate?.floor ?? 1),
      areaPyeong: String(candidate?.areaPyeong ?? 30),
    });
    setFormError("");
    if (candidate) onSelect(candidate.id);
    dialogRef.current?.showModal();
    nameRef.current?.focus();
  }

  function updateField(field: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: CandidateInput = {
      name: fields.name.trim(),
      address: fields.address.trim(),
      floor: Number(fields.floor),
      areaPyeong: Number(fields.areaPyeong),
    };
    if (!input.name || !input.address) {
      setFormError("후보 이름과 주소를 입력해주세요.");
      return;
    }
    if (!Number.isInteger(input.floor) || input.floor === 0 || input.floor < -5 || input.floor > 100) {
      setFormError("층수는 지하 5층부터 100층까지 입력할 수 있어요. 지하는 음수로 입력해주세요.");
      return;
    }
    if (!Number.isFinite(input.areaPyeong) || input.areaPyeong < 1 || input.areaPyeong > 10_000) {
      setFormError("면적을 1평 이상, 10,000평 이하로 입력해주세요.");
      return;
    }
    if (editingId) onUpdate(editingId, input);
    else if (!atLimit) onAdd(input);
    dialogRef.current?.close();
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      event.currentTarget.close();
    }
  }

  return (
    <aside className={styles.panel} aria-labelledby="candidates-title">
      <div className={styles.scroll}>
        <h1 className={styles.heading} id="candidates-title">후보 점포를 비교해요</h1>
        <button className={`${styles.description} ${styles.areaButton}`} type="button" onClick={onBack} title="분석 영역 다시 선택">
          {selection.address ?? "선택한 영역"} ({area}㎡)
        </button>

        <div className={styles.count}><span>등록된 후보</span><strong>{candidates.length}곳</strong></div>
        <ul className={styles.list} aria-label="후보 점포 목록">
          {candidates.map((candidate) => {
            const shortAddress = candidate.address.replace(/^대전(?:광역시)?\s+서구\s+/, "");
            const displayName = candidate.name.trim() || shortAddress;
            const showAddress = displayName !== shortAddress && displayName !== candidate.address;
            return <li key={candidate.id} className={styles.candidate}>
              <button
                className={`${styles.candidateButton} ${activeId === candidate.id ? styles.candidateSelected : ""}`}
                type="button"
                onClick={() => onSelect(candidate.id)}
                aria-pressed={activeId === candidate.id}
                aria-label={`${candidate.label} 후보, ${candidate.address}, 지도에서 보기`}
              >
                <span className={styles.badge}>{candidate.label}</span>
                <span className={`${styles.candidateInfo} ${showAddress ? styles.candidateInfoDetailed : ""}`}>
                  <span className={styles.address} title={displayName}>{displayName}</span>
                  {showAddress && <span className={styles.secondaryAddress} title={candidate.address}>{shortAddress}</span>}
                  <span className={styles.details}>
                    {candidate.floor < 0 ? `지하 ${Math.abs(candidate.floor)}층` : `${candidate.floor}층`} · {numberFormatter.format(candidate.areaPyeong)}평
                  </span>
                </span>
              </button>
              <button className={styles.edit} type="button" onClick={() => openEditor(candidate)} aria-label={`${candidate.label} 후보 정보 수정`}>수정</button>
            </li>;
          })}
          {candidates.length === 0 && <li className={styles.empty}>비교할 후보 점포를 추가해주세요.</li>}
        </ul>

        <button className={styles.addButton} type="button" onClick={() => openEditor()} disabled={atLimit}>
          {atLimit ? "후보 점포는 최대 5곳까지 등록할 수 있어요" : "+ 후보 점포 추가"}
        </button>
        <p className={styles.help}>후보 위치와 정보를 확인해주세요.<br />다음 단계에서 분석 조건을 설정해요.</p>
      </div>

      <div className={styles.footer}>
        <p className={styles.usageNote}>요청 시 월 제공 분석 1회를 사용해요</p>
        <div className={styles.usageRow}><span>이번 달 사용량</span><strong>3 / 10회 사용</strong></div>
        <div className={styles.progress} role="progressbar" aria-label="이번 달 분석 사용량" aria-valuemin={0} aria-valuemax={10} aria-valuenow={3}>
          <span style={{ width: "30%" }} />
        </div>
        <button className={styles.primary} type="button" onClick={onNext} disabled={candidates.length === 0}>다음: 분석 조건 설정&nbsp; →</button>
      </div>

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="candidate-editor-title" onClick={closeOnBackdrop}>
        <form onSubmit={submitCandidate}>
          <div className={styles.dialogHeader}>
            <h2 id="candidate-editor-title">{editingId ? "후보 점포 수정" : "후보 점포 추가"}</h2>
            <button className={styles.close} type="button" onClick={() => dialogRef.current?.close()} aria-label="후보 점포 창 닫기">×</button>
          </div>
          <p className={styles.dialogDescription}>비교할 점포의 주소와 공간 정보를 알려주세요.</p>
          <label className={styles.field}>
            후보 이름
            <input ref={nameRef} name="candidateName" autoComplete="off" value={fields.name} onChange={(event) => updateField("name", event.target.value)} required maxLength={60} placeholder="예: 시청역 앞 점포" />
          </label>
          <label className={styles.field}>
            주소
            <input name="candidateAddress" autoComplete="street-address" value={fields.address} onChange={(event) => updateField("address", event.target.value)} required maxLength={160} placeholder="예: 대전광역시 서구 둔산로 112" />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              층수
              <input name="candidateFloor" type="number" min={-5} max={100} step={1} value={fields.floor} onChange={(event) => updateField("floor", event.target.value)} required />
            </label>
            <label className={styles.field}>
              면적 (평)
              <input name="candidateArea" type="number" min={1} max={10_000} step={0.1} value={fields.areaPyeong} onChange={(event) => updateField("areaPyeong", event.target.value)} required />
            </label>
          </div>
          <p className={styles.fieldHint}>지하층은 -1처럼 입력해주세요.</p>
          {formError && <p className={styles.error} role="alert">{formError}</p>}
          <div className={styles.dialogFooter}>
            {editingId && <button className={styles.delete} type="button" onClick={() => { onRemove(editingId); dialogRef.current?.close(); }}>삭제</button>}
            <button className={styles.primary} type="submit">{editingId ? "변경사항 저장" : "후보 점포 등록"}</button>
          </div>
        </form>
      </dialog>
    </aside>
  );
}
