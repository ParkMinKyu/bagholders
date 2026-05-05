"use client";

import { useEffect, useRef, useState } from "react";
import {
  BOARD_BODY_MAX,
  BOARD_CATEGORIES,
  BOARD_NICK_MAX,
  BOARD_TITLE_MAX,
  type BoardCategoryKey,
} from "@/lib/board-config";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function BoardWriter({
  initialCategory = "free",
}: {
  initialCategory?: BoardCategoryKey;
}) {
  const [category, setCategory] = useState<string>(initialCategory);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [anonNickname, setAnonNickname] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
      setImageError("JPG/PNG/WebP/GIF만 가능");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("5MB 이하 파일만 가능");
      e.target.value = "";
      return;
    }
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="category" value={category} />

      <div>
        <label className="text-xs text-bag-mute">말머리</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {BOARD_CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-2.5 py-1 rounded-md border text-xs transition ${
                  active
                    ? "border-bag-accent bg-bag-accent/15 text-bag-accent"
                    : "border-bag-border text-bag-mute hover:text-white"
                }`}
              >
                [{c.label}]
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-bag-mute">제목</label>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={BOARD_TITLE_MAX}
          required
          placeholder="제목을 입력하세요"
          className="input mt-1"
          autoComplete="off"
        />
        <p className="text-[11px] text-bag-mute mt-1 text-right">
          {title.length}/{BOARD_TITLE_MAX}
        </p>
      </div>

      <div>
        <label className="text-xs text-bag-mute">본문</label>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BOARD_BODY_MAX}
          rows={10}
          required
          placeholder="본문을 입력하세요"
          className="input mt-1"
        />
        <p className="text-[11px] text-bag-mute mt-1 text-right">
          {body.length}/{BOARD_BODY_MAX}
        </p>
      </div>

      <div>
        <label className="text-xs text-bag-mute">이미지 (선택)</label>
        <p className="text-[10px] text-bag-mute opacity-70 mt-0.5">
          5MB 이하 JPG/PNG/WebP/GIF
        </p>
        <input
          ref={fileInputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageChange}
          className="mt-1.5 block w-full text-xs text-bag-mute file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-bag-border file:bg-bag-panel file:text-xs file:font-medium file:text-white hover:file:border-bag-accent hover:file:text-bag-accent file:cursor-pointer"
        />
        {imageError && (
          <p className="text-bag-accent text-[11px] mt-1">{imageError}</p>
        )}
        {imagePreview && (
          <div className="mt-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="미리보기"
              className="max-h-48 rounded-md border border-bag-border"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-1 right-1 rounded-full bg-black/70 hover:bg-black text-white w-6 h-6 flex items-center justify-center text-xs"
              aria-label="이미지 제거"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-bag-border bg-black/20 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="anon"
            checked={anon}
            onChange={(e) => setAnon(e.target.checked)}
            className="accent-bag-accent"
          />
          <span>익명으로 작성</span>
          <span className="text-[11px] text-bag-mute">
            (닉네임만 가림 — 운영자에겐 식별됨)
          </span>
        </label>
        {anon && (
          <input
            name="anon_nickname"
            value={anonNickname}
            onChange={(e) => setAnonNickname(e.target.value)}
            maxLength={BOARD_NICK_MAX}
            placeholder='닉네임 (비워두면 "ㅇㅇ")'
            className="input text-xs"
            autoComplete="off"
          />
        )}
      </div>

      <button
        className="btn-primary w-full"
        type="submit"
        disabled={!title.trim() || !body.trim()}
      >
        등록
      </button>
    </div>
  );
}
