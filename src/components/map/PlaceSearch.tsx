"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { PlaceResult } from "@/types/map";
import styles from "./PlaceSearch.module.css";

interface PlaceSearchProps {
  onSelect: (result: PlaceResult) => void;
  disabled?: boolean;
}

export default function PlaceSearch({ onSelect, disabled = false }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedQuery = useRef<string | null>(null);
  const id = useId();
  const listId = `${id}-results`;
  const statusId = `${id}-status`;

  const cancelSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    requestVersion.current += 1;
  }, []);

  const search = useCallback(async (value: string) => {
    cancelSearch();
    if (disabled) return;
    const normalized = value.trim();
    if (normalized.length < 2) {
      setError("검색어를 2자 이상 입력해주세요.");
      setOpen(true);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const version = requestVersion.current;
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 12_000);
    setOpen(true);
    setLoading(true);
    setSearched(false);
    setError("");
    setResults([]);
    setActiveIndex(-1);

    try {
      const response = await fetch(`/api/places?${new URLSearchParams({ q: normalized })}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = await response.json() as { results?: PlaceResult[]; error?: string; retryAfter?: number };
      if (version !== requestVersion.current) return;
      if (!response.ok) {
        setError(payload.error || "검색 결과를 불러오지 못했어요. 다시 시도해주세요.");
        return;
      }
      setResults(payload.results ?? []);
      setSearched(true);
    } catch {
      if (version !== requestVersion.current) return;
      if (!controller.signal.aborted || controller.signal.reason === "timeout") {
        setError("검색 연결이 지연되고 있어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) setLoading(false);
    }
  }, [cancelSearch, disabled]);

  useEffect(() => {
    cancelSearch();
    if (disabled || composing || query.trim().length < 2 || query === selectedQuery.current) return;
    debounceRef.current = setTimeout(() => void search(query), 350);
    return cancelSearch;
  }, [query, disabled, composing, search, cancelSearch]);

  useEffect(() => cancelSearch, [cancelSearch]);

  useEffect(() => {
    if (activeIndex >= 0) {
      listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  function select(result: PlaceResult) {
    cancelSearch();
    inputRef.current?.focus();
    selectedQuery.current = result.name;
    setQuery(result.name);
    setOpen(false);
    setLoading(false);
    setResults([]);
    setSearched(false);
    setError("");
    setActiveIndex(-1);
    onSelect(result);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing) return;
    if (open && activeIndex >= 0 && results[activeIndex]) {
      select(results[activeIndex]);
    } else {
      selectedQuery.current = null;
      void search(query);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelSearch();
      setLoading(false);
      setOpen(false);
      setActiveIndex(-1);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((previous) => event.key === "ArrowDown"
        ? (previous + 1) % results.length
        : (previous <= 0 ? results.length - 1 : previous - 1));
    }
  }

  const showDropdown = open && !disabled && (loading || Boolean(error) || searched);
  const status = loading ? "지역과 장소를 찾고 있어요…"
    : error || (searched && results.length === 0 ? "검색 결과가 없어요. 다른 지역이나 주소를 입력해주세요." : "");

  return (
    <div
      className={styles.search}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          cancelSearch();
          setLoading(false);
          setOpen(false);
        }
      }}
    >
      <form className={styles.field} onSubmit={submit} role="search" aria-label="지역과 장소 검색">
        <button className={styles.searchButton} type="submit" aria-label="검색" disabled={disabled}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/icon-search.svg" width={24} height={24} alt="" />
        </button>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="지역, 주소, 건물명 검색"
          aria-autocomplete="list"
          aria-controls={showDropdown && results.length ? listId : undefined}
          aria-expanded={showDropdown}
          aria-activedescendant={showDropdown && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-describedby={status ? statusId : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          placeholder="지역, 주소, 건물명을 검색하세요"
          value={query}
          disabled={disabled}
          onChange={(event) => {
            cancelSearch();
            selectedQuery.current = null;
            setQuery(event.target.value);
            setResults([]);
            setSearched(false);
            setLoading(false);
            setError("");
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => { if (searched || error) setOpen(true); }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
        />
      </form>

      {showDropdown && (
        <div className={styles.dropdown}>
          {status ? (
            <p className={`${styles.message} ${error ? styles.error : ""}`} id={statusId} role="status">
              {loading && <span className={styles.spinner} aria-hidden="true" />}
              {status}
            </p>
          ) : (
            <>
              <p className={styles.resultHeading} role="status">검색 결과 <span>{results.length}</span></p>
              <ul id={listId} ref={listRef} className={styles.results} role="listbox" aria-label="검색 결과">
                {results.map((result, index) => (
                  <li key={`${result.kind}-${result.id}`} role="presentation">
                    <button
                      type="button"
                      id={`${id}-option-${index}`}
                      className={`${styles.result} ${index === activeIndex ? styles.active : ""}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(result)}
                    >
                      <span className={styles.resultName}>{result.name}</span>
                      <span className={styles.resultAddress}>{result.address}</span>
                      <span className={styles.resultKind}>{result.kind === "address" ? "주소" : result.category?.split(" > ").at(-1) || "장소"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>↑ ↓ 이동 <span>Enter 선택</span></p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
