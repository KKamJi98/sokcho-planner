"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateReviewScore, type ReviewMetrics } from "@/lib/scoring";
import { submitComment } from "@/lib/comment-submit";

type Place = {
  id: number;
  category: "관광지" | "음식점";
  name: string;
  mapUrl: string;
  notes: string;
  planAt: string;
  personalRating: number;
  sortOrder: number;
  evaluation: (ReviewMetrics & { evidenceNote: string; verifiedAt: string }) | null;
};
type Comment = { id: number; placeId: number | null; author: string; content: string; createdAt: string };
type ScheduleItem = { id: number; startAt: string; endAt: string; title: string; transport: string; notes: string; sortOrder: number };
type Planner = { places: Place[]; comments: Comment[]; scheduleItems: ScheduleItem[] };

const mapSearchUrl = (name: string) => `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
const formatTime = (value: string) => value ? value.replace("T", " · ") : "시간 미정";

function naverSearchTerm(value: string) {
  try {
    const url = new URL(value);
    const searchPath = "/p/search/";
    const index = url.pathname.indexOf(searchPath);
    if (index >= 0) return decodeURIComponent(url.pathname.slice(index + searchPath.length)).trim();
    return (url.searchParams.get("query") ?? url.searchParams.get("q") ?? "").trim();
  } catch {
    return "";
  }
}

export default function PlannerPage() {
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const load = async () => {
    const response = await fetch("/api/planner");
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "계획을 불러오지 못했습니다.");
    setPlanner(data); setAuthenticated(true);
  };
  useEffect(() => { void load().catch((error: Error) => setMessage(error.message)); }, []);

  const request = async (method: "POST" | "PATCH" | "DELETE", body: object) => {
    const response = await fetch("/api/planner", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error ?? "저장하지 못했습니다."); setMessage(error.message); throw error; }
    setPlanner(data); setMessage("");
  };
  const remove = async (action: "place" | "schedule", id: number) => request("DELETE", { action, id });
  const groups = useMemo(() => ({
    관광지: planner?.places.filter((place) => place.category === "관광지") ?? [],
    음식점: planner?.places.filter((place) => place.category === "음식점") ?? [],
  }), [planner]);

  if (authenticated === false) return <LoginScreen onSuccess={load} />;
  if (!planner) return <main className="loading">속초 계획을 불러오는 중…</main>;

  return <main>
    <header className="hero">
      <p className="eyebrow">AUGUST 1 · SOKCHO</p><h1>우리의 속초 당일치기</h1>
      <p>장소·시간표·채팅·후기 기준을 한 곳에서 맞춰봐요. 별점이 높은 장소부터 정렬됩니다.</p>
      <div className="hero-actions"><a href="#timetable">타임테이블</a><a href="#places">장소 리스트</a><a href="#chat">우리 채팅</a></div>
    </header>
    {message && <p className="message" role="alert">{message}</p>}

    <section id="timetable" className="timetable">
      <div className="section-head"><div><p className="eyebrow">TIME TABLE</p><h2>오늘의 타임테이블</h2></div><button className="primary" onClick={() => setShowScheduleForm((value) => !value)}>+ 일정 추가</button></div>
      {showScheduleForm && <ScheduleForm onSubmit={async (body) => { await request("POST", { action: "schedule", ...body }); setShowScheduleForm(false); }} />}
      <div className="timeline">
        {planner.scheduleItems.map((item) => <article className="timeline-item" key={item.id}>
          <div className="timeline-time"><b>{formatTime(item.startAt)}</b><span>{item.endAt ? `~ ${formatTime(item.endAt)}` : "~ 도착 시간 확인"}</span></div>
          <div className="timeline-card"><div><p className="transport">{item.transport || "일정"}</p><h3>{item.title}</h3>{item.notes && <p>{item.notes}</p>}</div><button className="danger" onClick={() => { if (window.confirm(`“${item.title}” 일정을 제거할까요?`)) void remove("schedule", item.id); }}>제거</button></div>
        </article>)}
      </div>
    </section>

    <section id="places" className="places">
      <div className="section-head"><div><p className="eyebrow">OUR LIST</p><h2>가고 싶은 곳</h2></div><button className="primary" onClick={() => setShowPlaceForm((value) => !value)}>+ 장소 추가</button></div>
      {showPlaceForm && <PlaceForm onSubmit={async (body) => { await request("POST", { action: "place", ...body }); setShowPlaceForm(false); }} />}
      <p className="sort-note">★ 우리 별점 높은 순 · 같은 별점이면 기존 일정 순서</p>
      <div className="grid">{(["관광지", "음식점"] as const).map((category) => <section className="category" key={category}><h2>{category === "관광지" ? "🗺 관광지" : "🍽 음식점"}</h2><div className="cards">{groups[category].map((place) => <PlaceCard key={place.id} place={place} comments={planner.comments.filter((comment) => comment.placeId === place.id)} onComment={(body) => request("POST", { action: "comment", ...body, placeId: place.id })} onPatch={(body) => request("PATCH", { placeId: place.id, ...body })} onDelete={() => remove("place", place.id)} onEvaluation={(metrics) => request("POST", { action: "evaluation", placeId: place.id, metrics })} />)}{groups[category].length === 0 && <p className="empty">아직 없어요. 첫 후보를 추가해보세요.</p>}</div></section>)}</div>
    </section>

    <section id="rubric" className="rubric"><p className="eyebrow">REVIEW RUBRIC</p><h2>맛집 비교는 100점으로</h2><p className="muted">서로 다른 지도 2곳 이상에서 최신 근거를 확인합니다. 플랫폼별 평점·리뷰 수 기준이 달라 단순 평균으로 결정하지 않아요.</p><div className="rubric-grid"><div><strong>교차 확인 · 30</strong><span>플랫폼 수와 평점 일관성</span></div><div><strong>리뷰 규모 · 15</strong><span>합산 리뷰 수는 신뢰도 보조</span></div><div><strong>최신성 · 15</strong><span>확인일 14일 이내 우선</span></div><div><strong>후기 내용 · 25</strong><span>맛·서비스·반복 부정 신호</span></div><div><strong>방문 가능성 · 15</strong><span>대기·예약·동선</span></div></div><p className="fine">추천선은 75점 이상 + 영업·대기·예약·위생·동선 PASS입니다.</p></section>

    <section id="chat" className="global-comments"><div className="section-head"><div><p className="eyebrow">OUR CHAT</p><h2>💬 우리 채팅</h2></div></div><div className="chat-window">{planner.comments.filter((comment) => comment.placeId == null).map((comment) => <CommentView key={comment.id} comment={comment} />)}{planner.comments.filter((comment) => comment.placeId == null).length === 0 && <p className="empty">첫 메시지를 남겨보세요.</p>}</div><CommentForm onSubmit={(body) => request("POST", { action: "comment", ...body, placeId: null })} /></section>
  </main>;
}

function LoginScreen({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  return <main className="login-screen"><form onSubmit={async (event) => { event.preventDefault(); const password = String(new FormData(event.currentTarget).get("password")); setSaving(true); setError(""); try { const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "로그인 실패"); await onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "로그인 실패"); } finally { setSaving(false); } }}><p className="eyebrow">PRIVATE TRIP PLAN</p><h1>속초 플래너</h1><input name="password" type="password" required placeholder="공유 비밀번호" autoFocus /><button className="primary" disabled={saving}>{saving ? "확인 중" : "입장하기"}</button>{error && <p className="message">{error}</p>}</form></main>;
}

function PlaceForm({ onSubmit }: { onSubmit: (body: Record<string, string>) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [name, setName] = useState(""); const [mapUrl, setMapUrl] = useState("");
  return <form className="place-form" onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { await onSubmit({ category: String(new FormData(event.currentTarget).get("category")), name, mapUrl: mapUrl || mapSearchUrl(name), notes: String(new FormData(event.currentTarget).get("notes")), planAt: String(new FormData(event.currentTarget).get("planAt")) }); } finally { setSaving(false); } }}><select name="category" defaultValue="음식점"><option>관광지</option><option>음식점</option></select><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="장소명" /><input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} onBlur={() => { if (!name.trim()) setName(naverSearchTerm(mapUrl)); }} placeholder="네이버지도 링크 (검색어 자동 입력)" /><input name="planAt" type="datetime-local" /><input name="notes" placeholder="메모·추천 메뉴·예약 정보" /><button className="primary" disabled={saving}>{saving ? "저장 중" : "저장"}</button><p className="form-tip">네이버 지도 검색 링크만 붙여도 장소명이 비어 있으면 검색어를 채웁니다. 지점명·주소는 저장 전 확인하세요.</p></form>;
}

function ScheduleForm({ onSubmit }: { onSubmit: (body: Record<string, string>) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return <form className="schedule-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await onSubmit({ startAt: String(form.get("startAt")), endAt: String(form.get("endAt")), title: String(form.get("title")), transport: String(form.get("transport")), notes: String(form.get("notes")) }); event.currentTarget.reset(); } finally { setSaving(false); } }}><input name="startAt" type="datetime-local" required defaultValue="2026-08-01T12:00" /><input name="endAt" type="datetime-local" /><input name="title" required placeholder="예: 속초아이 대관람차" /><input name="transport" placeholder="예: 택시 · 도보 · 고속버스" /><input name="notes" placeholder="메모·예약·만나는 곳" /><button className="primary" disabled={saving}>{saving ? "저장 중" : "일정 저장"}</button></form>;
}

function PlaceCard({ place, comments, onComment, onPatch, onDelete, onEvaluation }: { place: Place; comments: Comment[]; onComment: (body: { author: string; content: string }) => Promise<void>; onPatch: (body: object) => Promise<void>; onDelete: () => Promise<void>; onEvaluation: (metrics: Record<string, number | string>) => Promise<void> }) {
  const [editing, setEditing] = useState(false); const [evaluating, setEvaluating] = useState(false); const score = place.evaluation ? calculateReviewScore(place.evaluation) : null;
  return <article className="card"><div className="card-top"><div><p className="plan-time">{place.planAt ? formatTime(place.planAt) : "시간 미정"}</p><h3>{place.name}</h3></div><a className="map-link" href={place.mapUrl} target="_blank" rel="noreferrer">네이버지도 ↗</a></div><StarRating value={place.personalRating} onChange={(rating) => void onPatch({ rating })} /><p>{place.notes || "메모를 남겨보세요."}</p>{score?.score != null && <p className="score">리뷰 기준 {score.score}점 · {score.confidence}</p>}<div className="card-actions"><button onClick={() => setEditing((value) => !value)}>일정/메모</button><button onClick={() => setEvaluating((value) => !value)}>리뷰 평가</button><button className="danger" onClick={() => { if (window.confirm(`“${place.name}”을(를) 제거할까요?`)) void onDelete(); }}>제거</button></div>{editing && <EditPlace place={place} onSave={async (body) => { await onPatch(body); setEditing(false); }} />}{evaluating && <EvaluationForm place={place} onSave={async (metrics) => { await onEvaluation(metrics); setEvaluating(false); }} />}<div className="place-chat">{comments.map((comment) => <CommentView key={comment.id} comment={comment} />)}<CommentForm compact onSubmit={onComment} /></div></article>;
}

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => void }) { return <div className="stars" aria-label={`우리 별점 ${value}점`}><span>우리 별점</span>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= value ? "filled" : ""} onClick={() => onChange(star)} aria-label={`${star}점`}>★</button>)}{value > 0 && <button type="button" className="clear-rating" onClick={() => onChange(0)}>지우기</button>}</div>; }
function EditPlace({ place, onSave }: { place: Place; onSave: (body: { notes: string; planAt: string }) => Promise<void> }) { return <form className="inline-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onSave({ notes: String(form.get("notes")), planAt: String(form.get("planAt")) }); }}><input name="planAt" type="datetime-local" defaultValue={place.planAt} /><input name="notes" defaultValue={place.notes} /><button>반영</button></form>; }
function CommentForm({ onSubmit, compact = false }: { onSubmit: (body: { author: string; content: string }) => Promise<void>; compact?: boolean }) { const [saving, setSaving] = useState(false); return <form className={compact ? "comment-form compact" : "comment-form"} onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setSaving(true); try { await submitComment({ author: String(form.get("author")), content: String(form.get("content")) }, onSubmit, () => formElement.reset()); } finally { setSaving(false); } }}><input name="author" placeholder="이름 (기본: 우리)" /><input name="content" required placeholder={compact ? "장소 메모 남기기" : "같이 정할 내용을 남겨보세요"} /><button disabled={saving}>{saving ? "…" : "보내기"}</button></form>; }
function CommentView({ comment }: { comment: Comment }) { return <div className="comment"><b>{comment.author}</b><span>{comment.content}</span><time>{new Date(comment.createdAt + "Z").toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</time></div>; }
function EvaluationForm({ place, onSave }: { place: Place; onSave: (metrics: Record<string, number | string>) => Promise<void> }) { const values: Record<string, number | string | null | undefined> = place.evaluation ?? {}; const [saving, setSaving] = useState(false); const fields = [["naverRating", "네이버 평점 (0–5)"], ["naverReviews", "네이버 리뷰 수"], ["googleRating", "Google 평점 (0–5)"], ["googleReviews", "Google 리뷰 수"], ["kakaoRating", "카카오 평점 (0–5)"], ["kakaoReviews", "카카오 리뷰 수"], ["food", "음식 (0–100)"], ["service", "서비스 (0–100)"], ["ambience", "분위기 (0–100)"], ["value", "가성비 (0–100)"], ["wait", "대기 (0–100)"], ["itineraryFit", "동선 (0–100)"]] as const; return <form className="evaluation-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const metrics: Record<string, number | string> = {}; fields.forEach(([key]) => { const value = String(form.get(key)); if (value) metrics[key] = Number(value); }); metrics.evidenceNote = String(form.get("evidenceNote")); metrics.verifiedAt = String(form.get("verifiedAt")); setSaving(true); try { await onSave(metrics); } finally { setSaving(false); } }}><p className="fine">평점·리뷰 수·확인일·후기 근거를 함께 남기세요.</p><div className="metric-grid">{fields.map(([key, label]) => <label key={key}>{label}<input name={key} type="number" min="0" max={key.includes("Rating") ? "5" : undefined} defaultValue={values[key] ?? ""} /></label>)}</div><input name="verifiedAt" type="date" defaultValue={String(values.verifiedAt ?? "")} /><textarea name="evidenceNote" defaultValue={String(values.evidenceNote ?? "")} placeholder="플랫폼 링크·후기 반복 신호·대기/위생/예약 근거" /><button disabled={saving}>{saving ? "저장 중" : "리뷰 평가 저장"}</button></form>; }
