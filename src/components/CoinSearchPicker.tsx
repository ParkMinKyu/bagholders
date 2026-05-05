"use client";

import { useEffect, useRef, useState } from "react";
import { POST_KINDS, type PostKind } from "@/lib/post-kinds";

type Coin = {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;
  market_cap_rank?: number | null;
};

function fmtKRW(n: number | null) {
  if (n === null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `₩${Math.round(n).toLocaleString("ko-KR")}`;
  if (n >= 1) return `₩${n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  return `₩${n.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}`;
}

export function CoinSearchPicker({
  initialKind = "buy_high",
}: {
  initialKind?: PostKind;
}) {
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Coin[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Coin | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [pricedAt, setPricedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || selected?.name === query) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/coins/search?q=${encodeURIComponent(query)}`);
        const data = (await r.json()) as { coins: Coin[] };
        setResults(data.coins ?? []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  useEffect(() => {
    if (!selected) {
      setLivePrice(null);
      setPricedAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/coins/search?id=${encodeURIComponent(selected.id)}`);
        const data = (await r.json()) as { price: number | null };
        if (!cancelled) {
          setLivePrice(data.price);
          setPricedAt(Date.now());
        }
      } catch {
        if (!cancelled) {
          setLivePrice(null);
          setPricedAt(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const kindMeta = POST_KINDS.find((k) => k.key === kind)!;

  return (
    <div className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {selected && (
        <>
          <input type="hidden" name="ticker_code" value={selected.id} />
          <input type="hidden" name="ticker_symbol" value={selected.symbol.toUpperCase()} />
          <input type="hidden" name="ticker_name" value={selected.name} />
        </>
      )}

      <div>
        <label className="text-xs text-bag-mute">어떤 인증인가요?</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {POST_KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <button
                type="button"
                key={k.key}
                onClick={() => setKind(k.key)}
                className={`rounded-md border py-3 text-sm transition ${
                  active
                    ? k.key === "buy_high"
                      ? "border-bag-accent bg-bag-accent/10 text-bag-accent"
                      : "border-sky-400 bg-sky-400/10 text-sky-300"
                    : "border-bag-border hover:border-white/30"
                }`}
              >
                <div className="font-bold">{k.short}</div>
                <div className="text-[11px] opacity-80 mt-0.5">{k.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative" ref={wrapRef}>
        <label className="text-xs text-bag-mute">코인 검색</label>
        <input
          className="input mt-1"
          placeholder="비트코인, btc, doge ..."
          value={selected ? `${selected.name} (${selected.symbol.toUpperCase()})` : query}
          onChange={(e) => {
            setSelected(null);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {open && (results.length > 0 || loading) && (
          <ul className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-md border border-bag-border bg-bag-panel shadow-xl">
            {loading && (
              <li className="px-3 py-2 text-xs text-bag-mute">검색 중…</li>
            )}
            {!loading &&
              results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2"
                    onClick={() => {
                      setSelected(c);
                      setQuery(`${c.name} (${c.symbol.toUpperCase()})`);
                      setOpen(false);
                    }}
                  >
                    {c.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumb} alt="" className="w-5 h-5 rounded-full" />
                    )}
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-bag-mute">
                      {c.symbol.toUpperCase()}
                    </span>
                    {c.market_cap_rank != null && (
                      <span className="ml-auto text-[10px] text-bag-mute">
                        #{c.market_cap_rank}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
        {selected && livePrice !== null && (
          <div className="mt-2 text-xs text-bag-mute">
            현재가:{" "}
            <span className="text-white font-mono">{fmtKRW(livePrice)}</span>
            {pricedAt && (
              <span className="ml-1 opacity-60">
                · {new Date(pricedAt).toLocaleTimeString("ko-KR")}
              </span>
            )}
            <span className="ml-1 opacity-60">· 5분마다 갱신</span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-bag-mute">{kindMeta.priceLabel}</label>
        <input
          className="input mt-1"
          name="entry_price"
          type="number"
          step="any"
          min="0"
          required
          placeholder="예: 95000000"
        />
        <p className="text-[11px] text-bag-mute mt-1">
          {kind === "buy_high"
            ? "지금 현재가와 비교해 손실률이 자동 계산됩니다."
            : "지금 현재가와 비교해 기회손실률이 자동 계산됩니다."}
        </p>
      </div>

      <div>
        <label className="text-xs text-bag-mute">수량 (선택)</label>
        <input
          className="input mt-1"
          name="quantity"
          type="number"
          step="any"
          min="0"
          placeholder="비워두면 평가손익액 계산 안 함"
        />
      </div>

      <div>
        <label className="text-xs text-bag-mute">한줄평 (선택)</label>
        <textarea
          className="input mt-1"
          name="comment"
          rows={3}
          maxLength={500}
          placeholder="예: 어제 사면 됐는데 오늘 사버림. 이게 나야."
        />
      </div>

      <button className="btn-primary w-full" type="submit" disabled={!selected}>
        {selected
          ? `공개 망신 등록 (${selected.symbol.toUpperCase()})`
          : "코인을 먼저 골라주세요"}
      </button>
    </div>
  );
}
