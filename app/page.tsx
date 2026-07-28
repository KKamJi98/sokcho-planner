"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { submitComment } from "@/lib/comment-submit";
import { naverSearchTitle } from "@/lib/naver-map";
import { calculateReviewScore, type ReviewMetrics } from "@/lib/scoring";

type Place = {
  id: number;
  category: "관광지" | "음식점";
  name: string;
  mapUrl: string;
  notes: string;
  planAt: string;
  planEndAt: string;
  personalRating: number;
  sortOrder: number;
  evaluation: (ReviewMetrics & { evidenceNote: string; verifiedAt: string }) | null;
};
type ScheduleItem = { id: number; placeId: number | null; startAt: string; endAt: string; title: string; transport: string; notes: string; sortOrder: number };
type Comment = { id: number; placeId: number | null; author: string; content: string; createdAt: string };
type Planner = { places: Place[]; scheduleItems: ScheduleItem[]; comments: Comment[] };
type ScheduleDraft = Omit<ScheduleItem, "id" | "placeId" | "sortOrder">;

const transportOptions = ["방문", "고속버스", "시내버스", "택시", "도보", "자가용", "기타"];

export default function Home() {
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);

  const load = async () => {
    const response = await fetch("/api/planner", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "플래너를 불러오지 못했습니다.");
    setPlanner(data); setAuthenticated(true);
  };
  useEffect(() => { void load().catch((error: Error) => setMessage(error.message)); }, []);

  const request = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    setMessage("");
    const response = await fetch("/api/planner", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "저장하지 못했습니다."); throw new Error(data.error ?? "저장 실패"); }
    setPlanner(data);
  };
  const remove = async (action: "place" | "schedule", id: number) => { await request("DELETE", { action, id }); };

  const groups = useMemo(() => ({
    관광지: planner?.places.filter((place) => place.category === "관광지") ?? [],
    음식점: planner?.places.filter((place) => place.category === "음식점") ?? [],
  }), [planner]);

  if (authenticated === false) return <LoginScreen onSuccess={load} />;
  if (!planner || authenticated == null) return <main className="loading">속초 플래너를 불러오는 중…</main>;

  return <main className="planner-shell">
    <header className="hero">
      <p className="eyebrow">SOKCHO · AUG 01</p>
      <h1>우리의 속초 하루</h1>
      <p>시간을 정한 장소는 타임테이블에 자동으로 들어가요. 별을 눌러 우선순위도 함께 정해봐요.</p>
      <nav className="hero-actions" aria-label="빠른 이동"><a href="#timetable">타임테이블</a><a href="#places">가고 싶은 곳</a><a href="#chat">우리 채팅</a></nav>
    </header>
    {message && <p className="message" role="alert">{message}</p>}

    <section id="timetable" className="panel timetable-panel">
      <div className="section-head"><div><p className="eyebrow">TIME TABLE</p><h2>시간표</h2><p className="muted">장소 카드에서 시작·종료 시간을 저장하면 이 표에 자동 반영됩니다.</p></div><button className="button primary" onClick={() => { setShowScheduleForm((value) => !value); setEditingScheduleId(null); }}>＋ 일정 추가</button></div>
      {showScheduleForm && <div className="form-tray"><ScheduleForm submitLabel="일정 추가" onCancel={() => setShowScheduleForm(false)} onSubmit={async (draft) => { await request("POST", { action: "schedule", ...draft }); setShowScheduleForm(false); }} /></div>}
      <div className="table-wrap"><table className="timetable-table"><thead><tr><th>시간</th><th>이동 / 일정</th><th>메모</th><th aria-label="작업" /></tr></thead><tbody>
        {planner.scheduleItems.length === 0 && <tr><td colSpan={4} className="empty-cell">아직 정한 일정이 없어요. 장소에서 시간을 정하거나 일정을 추가해보세요.</td></tr>}
        {planner.scheduleItems.map((item) => editingScheduleId === item.id ? <tr key={item.id}><td colSpan={4} className="editor-cell"><ScheduleForm initial={item} submitLabel="수정 저장" onCancel={() => setEditingScheduleId(null)} onSubmit={async (draft) => { await request("PATCH", { action: "schedule", id: item.id, ...draft }); setEditingScheduleId(null); }} /></td></tr> : <tr key={item.id}>
          <td data-label="시간" className="time-cell"><strong>{formatDateTime(item.startAt)}</strong><span>{item.endAt ? `– ${formatTime(item.endAt)}` : "도착 시간 미정"}</span></td>
          <td data-label="이동 / 일정"><span className="transport-chip">{item.transport || "일정"}</span><strong className="schedule-title">{item.title}</strong>{item.placeId != null && <span className="linked-badge">장소 연동</span>}</td>
          <td data-label="메모" className="notes-cell">{item.notes || "—"}</td>
          <td className="action-cell"><button className="icon-button" title="일정 수정" aria-label={`${item.title} 수정`} onClick={() => { setEditingScheduleId(item.id); setShowScheduleForm(false); }}>✎</button><button className="icon-button danger" title="일정 제거" aria-label={`${item.title} 제거`} onClick={() => { if (window.confirm(`“${item.title}” 일정을 제거할까요?`)) void remove("schedule", item.id); }}>×</button></td>
        </tr>)}
      </tbody></table></div>
    </section>

    <section id="places" className="places-section">
      <div className="section-head"><div><p className="eyebrow">OUR LIST</p><h2>가고 싶은 곳</h2><p className="muted">별점이 높은 순으로 보여요. 별을 다시 누르면 현재 점수가 바로 보여요.</p></div><button className="button primary" onClick={() => setShowPlaceForm((value) => !value)}>＋ 장소 추가</button></div>
      {showPlaceForm && <div className="form-tray"><PlaceForm onCancel={() => setShowPlaceForm(false)} onSubmit={async (draft) => { await request("POST", { action: "place", ...draft }); setShowPlaceForm(false); }} /></div>}
      <div className="place-grid">{(["관광지", "음식점"] as const).map((category) => <section className="place-category" key={category}><div className="category-title"><span>{category === "관광지" ? "🗺" : "🍽"}</span><h3>{category}</h3></div>{groups[category].map((place) => <PlaceCard key={place.id} place={place} comments={planner.comments.filter((comment) => comment.placeId === place.id)} onRate={(rating) => request("PATCH", { placeId: place.id, rating })} onSave={(draft) => request("PATCH", { placeId: place.id, ...draft })} onDelete={() => { if (window.confirm(`“${place.name}”과 연결된 일정·댓글을 제거할까요?`)) void remove("place", place.id); }} onComment={(draft) => request("POST", { action: "comment", placeId: place.id, ...draft })} onEvaluation={(metrics) => request("POST", { action: "evaluation", placeId: place.id, metrics })} />)}</section>)}</div>
    </section>

    <section className="panel rubric"><p className="eyebrow">REVIEW RUBRIC</p><h2>맛집 비교 기준</h2><p>플랫폼별 평점·리뷰 수는 확인 시점과 근거를 함께 남기고, 개인 별점은 우리 취향 우선순위로 사용해요.</p><div className="rubric-list"><span>교차 확인 30</span><span>리뷰 규모 15</span><span>최신성 15</span><span>후기 내용 25</span><span>동선 15</span></div></section>

    <section id="chat" className="panel chat-panel"><div className="section-head"><div><p className="eyebrow">OUR CHAT</p><h2>💬 우리 채팅</h2><p className="muted">이름은 유지하고, 전송한 메시지만 비워집니다.</p></div></div><div className="chat-window">{planner.comments.filter((comment) => comment.placeId == null).map((comment) => <CommentView key={comment.id} comment={comment} />)}{planner.comments.every((comment) => comment.placeId != null) && <p className="empty">첫 메시지를 남겨보세요.</p>}</div><CommentForm onSubmit={(draft) => request("POST", { action: "comment", ...draft })} /></section>
  </main>;
}

function LoginScreen({ onSuccess }: { onSuccess: () => Promise<void> }) { const [error, setError] = useState(""); const [saving, setSaving] = useState(false); return <main className="login-screen"><form onSubmit={async (event) => { event.preventDefault(); const password = String(new FormData(event.currentTarget).get("password")); setSaving(true); setError(""); try { const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "로그인 실패"); await onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "로그인 실패"); } finally { setSaving(false); } }}><p className="eyebrow">PRIVATE ITINERARY</p><h1>우리만의 속초 플래너</h1><input name="password" type="password" required autoFocus placeholder="공유 비밀번호" /><button className="button primary" disabled={saving}>{saving ? "확인 중…" : "입장하기"}</button>{error && <p className="message">{error}</p>}</form></main>; }

function PlaceCard({ place, comments, onRate, onSave, onDelete, onComment, onEvaluation }: { place: Place; comments: Comment[]; onRate: (rating: number) => Promise<void>; onSave: (draft: { notes: string; planAt: string; planEndAt: string }) => Promise<void>; onDelete: () => void; onComment: (draft: { author: string; content: string }) => Promise<void>; onEvaluation: (metrics: Record<string, number | string>) => Promise<void> }) { const [editing, setEditing] = useState(false); const [reviewing, setReviewing] = useState(false); return <article className="place-card"><div className="place-card-top"><div><h4>{place.name}</h4><StarRating value={place.personalRating} onChange={onRate} /></div><div className="card-actions"><a className="icon-button" href={place.mapUrl} target="_blank" rel="noreferrer" title="네이버지도">N</a><button className="icon-button danger" title="장소 제거" onClick={onDelete}>×</button></div></div><div className="map-links"><a href={place.mapUrl} target="_blank" rel="noreferrer">네이버지도</a><a href={googleMap(place.name)} target="_blank" rel="noreferrer">Google</a><a href={kakaoMap(place.name)} target="_blank" rel="noreferrer">카카오</a></div>{place.notes && <p className="place-notes">{place.notes}</p>}<p className={place.planAt ? "scheduled-status active" : "scheduled-status"}>{place.planAt ? `🗓 ${formatDateTime(place.planAt)}${place.planEndAt ? ` – ${formatTime(place.planEndAt)}` : ""} · 타임테이블 연동됨` : "시간을 정하면 타임테이블에 자동 추가돼요."}</p><div className="inline-actions"><button className="button secondary" onClick={() => setEditing((value) => !value)}>{editing ? "접기" : place.planAt ? "시간·메모 수정" : "시간 정하기"}</button><button className="button ghost" onClick={() => setReviewing((value) => !value)}>{reviewing ? "평가 닫기" : "리뷰 평가"}</button></div>{editing && <PlaceScheduleForm place={place} onCancel={() => setEditing(false)} onSave={async (draft) => { await onSave(draft); setEditing(false); }} />}{reviewing && <EvaluationForm place={place} onSave={onEvaluation} />}<div className="place-comments">{comments.map((comment) => <CommentView comment={comment} key={comment.id} />)}<CommentForm compact onSubmit={onComment} /></div></article>; }

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => Promise<void> }) { return <div className="star-rating" aria-label={`우리 별점 ${value}점`}><span className="star-value">{value ? `${value} / 5` : "미평가"}</span><div>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= value ? "star filled" : "star"} aria-label={`${star}점`} onClick={() => void onChange(star)}>★</button>)}</div>{value > 0 && <button className="rating-reset" type="button" onClick={() => void onChange(0)}>초기화</button>}</div>; }

function PlaceScheduleForm({ place, onSave, onCancel }: { place: Place; onSave: (draft: { notes: string; planAt: string; planEndAt: string }) => Promise<void>; onCancel: () => void }) { const [saving, setSaving] = useState(false); return <form className="schedule-form place-editor" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); try { await onSave({ planAt: String(data.get("planAt")), planEndAt: String(data.get("planEndAt")), notes: String(data.get("notes")) }); } finally { setSaving(false); } }}><label>시작<input name="planAt" type="datetime-local" defaultValue={place.planAt} /></label><label>종료<input name="planEndAt" type="datetime-local" defaultValue={place.planEndAt} /></label><label className="wide">메모<input name="notes" defaultValue={place.notes} placeholder="예: 대기 20분 고려" /></label><p className="form-tip">시간을 비우고 저장하면 이 장소의 자동 타임테이블 항목도 제거됩니다.</p><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>취소</button><button className="button primary" disabled={saving}>{saving ? "저장 중…" : "시간표 반영"}</button></div></form>; }

function PlaceForm({ onSubmit, onCancel }: { onSubmit: (draft: { category: "관광지" | "음식점"; name: string; mapUrl: string; notes: string; planAt: string; planEndAt: string }) => Promise<void>; onCancel: () => void }) { const [name, setName] = useState(""); const [nameEdited, setNameEdited] = useState(false); const [mapUrl, setMapUrl] = useState(""); const [saving, setSaving] = useState(false); const setMapAndTitle = (value: string) => { setMapUrl(value); const detected = naverSearchTitle(value); if (detected && !nameEdited) setName(detected); }; return <form className="schedule-form place-form" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); try { await onSubmit({ category: String(data.get("category")) as "관광지" | "음식점", name, mapUrl, notes: String(data.get("notes")), planAt: String(data.get("planAt")), planEndAt: String(data.get("planEndAt")) }); } finally { setSaving(false); } }}><label>분류<select name="category" defaultValue="관광지"><option>관광지</option><option>음식점</option></select></label><label>장소명<input value={name} required onChange={(event) => { setNameEdited(true); setName(event.target.value); }} placeholder="장소명 또는 식당명" /></label><label className="wide">네이버지도 링크<input value={mapUrl} required onChange={(event) => setMapAndTitle(event.target.value)} placeholder="네이버 지도 검색 링크를 붙여넣으세요" /></label><label>시작 시간 (선택)<input name="planAt" type="datetime-local" /></label><label>종료 시간 (선택)<input name="planEndAt" type="datetime-local" /></label><label className="wide">메모<input name="notes" placeholder="메뉴, 대기, 동선 메모" /></label><p className="form-tip">검색형 네이버 링크의 제목은 입력 즉시 자동 반영됩니다. 직접 장소·단축 링크처럼 검색어가 없는 URL은 제목을 추측하지 않으니 직접 입력해주세요. 시간을 설정하면 타임테이블도 자동 생성됩니다.</p><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>취소</button><button className="button primary" disabled={saving}>{saving ? "추가 중…" : "장소 추가"}</button></div></form>; }

function ScheduleForm({ initial, onSubmit, onCancel, submitLabel }: { initial?: ScheduleItem; onSubmit: (draft: ScheduleDraft) => Promise<void>; onCancel: () => void; submitLabel: string }) { const [saving, setSaving] = useState(false); return <form className="schedule-form" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); try { await onSubmit({ startAt: String(data.get("startAt")), endAt: String(data.get("endAt")), title: String(data.get("title")), transport: String(data.get("transport")), notes: String(data.get("notes")) }); } finally { setSaving(false); } }}><label>시작<input name="startAt" required type="datetime-local" defaultValue={initial?.startAt ?? ""} /></label><label>종료<input name="endAt" type="datetime-local" defaultValue={initial?.endAt ?? ""} /></label><label>일정 / 목적지<input name="title" required defaultValue={initial?.title ?? ""} placeholder="예: 속초터미널 → 아바이마을" /></label><label>이동수단<select name="transport" defaultValue={initial?.transport || "방문"}>{transportOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label className="wide">메모<input name="notes" defaultValue={initial?.notes ?? ""} placeholder="탑승 위치, 예약, 이동 메모" /></label><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>취소</button><button className="button primary" disabled={saving}>{saving ? "저장 중…" : submitLabel}</button></div></form>; }

function CommentForm({ onSubmit, compact = false }: { onSubmit: (draft: { author: string; content: string }) => Promise<void>; compact?: boolean }) { const [author, setAuthor] = useState(""); const [content, setContent] = useState(""); const [saving, setSaving] = useState(false); return <form className={compact ? "comment-form compact" : "comment-form"} onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { const cleared = await submitComment({ author, content }, onSubmit); setContent(cleared.content); } finally { setSaving(false); } }}><input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="이름 (기본: 우리)" /><input value={content} onChange={(event) => setContent(event.target.value)} required placeholder={compact ? "장소 메모 남기기" : "같이 정할 내용을 남겨보세요"} /><button className="button primary" disabled={saving}>{saving ? "…" : "보내기"}</button></form>; }

function CommentView({ comment }: { comment: Comment }) { return <article className="comment"><header><b>{comment.author}</b><time>{new Date(`${comment.createdAt}Z`).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</time></header><p>{comment.content}</p></article>; }

function EvaluationForm({ place, onSave }: { place: Place; onSave: (metrics: Record<string, number | string>) => Promise<void> }) { const values: Record<string, number | string | null | undefined> = place.evaluation ?? {}; const [saving, setSaving] = useState(false); const fields = [["naverRating", "네이버 평점", "5"], ["naverReviews", "네이버 리뷰 수", undefined], ["googleRating", "Google 평점", "5"], ["googleReviews", "Google 리뷰 수", undefined], ["kakaoRating", "카카오 평점", "5"], ["kakaoReviews", "카카오 리뷰 수", undefined], ["food", "음식", "100"], ["service", "서비스", "100"], ["ambience", "분위기", "100"], ["value", "가성비", "100"], ["wait", "대기", "100"], ["itineraryFit", "동선", "100"]] as const; const score = calculateReviewScore(values as ReviewMetrics); return <form className="evaluation-form" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const metrics: Record<string, number | string> = {}; fields.forEach(([key]) => { const value = String(data.get(key)); if (value) metrics[key] = Number(value); }); metrics.evidenceNote = String(data.get("evidenceNote")); metrics.verifiedAt = String(data.get("verifiedAt")); setSaving(true); try { await onSave(metrics); } finally { setSaving(false); } }}><p className="fine">플랫폼 수치와 확인일·근거를 함께 저장하세요. {score.score != null && <strong> 현재 계산 {score.score}점</strong>}</p><div className="metric-grid">{fields.map(([key, label, max]) => <label key={key}>{label}<input name={key} type="number" min="0" max={max} defaultValue={values[key] ?? ""} /></label>)}</div><label>확인일<input name="verifiedAt" type="date" defaultValue={String(values.verifiedAt ?? "")} /></label><label>근거<textarea name="evidenceNote" defaultValue={String(values.evidenceNote ?? "")} placeholder="확인 링크, 대기·영업·위생 신호" /></label><button className="button secondary" disabled={saving}>{saving ? "저장 중…" : "리뷰 평가 저장"}</button></form>; }

function googleMap(name: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`; }
function kakaoMap(name: string) { return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`; }
function formatDateTime(value: string) { if (!value) return "시간 미정"; return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); }
function formatTime(value: string) { if (!value) return ""; return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }); }
