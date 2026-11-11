import type { AnalysisSelection } from "./analysis";

export type DemoStep = "select" | "candidates" | "conditions" | "progress" | "result" | "history";
export type AddonId = "competitor" | "night" | "accessibility" | "candidateComparison";
export interface CandidateInput {
  name: string;
  address: string;
  floor: number;
  areaPyeong: number;
}
export interface DemoCandidate extends CandidateInput {
  id: string;
  label: string;
  lat: number;
  lng: number;
  score: number;
}
export interface DemoSettings {
  purpose: string;
  industry: string;
  targetMonthlySales: string;
  storeType: string;
  targetCustomers: string[];
  notes: string;
  addons: AddonId[];
}
export interface DemoReport {
  id: string;
  name: string;
  selection: AnalysisSelection;
  candidates: DemoCandidate[];
  settings: DemoSettings;
  createdAt: string;
  status: "completed" | "processing" | "candidate";
  score: number;
  metrics: { label: string; value: number }[];
  recommendedCandidateId: string;
}
