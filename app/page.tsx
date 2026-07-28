"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateReviewScore, type ReviewMetrics } from "@/lib/scoring";

type Place = {
  id: number; category: "관광지" | "음식점"; name: string; mapUrl: string; notes: string; planAt: string;
  evaluation: (ReviewMetrics & { evidenceNote: string; verifiedAt: string }) | null;
};
type Comment = { id: number; placeId: number | null; author: string; content: string; createdAt: string };
type Planner = { places: Place[]; comments: Comment[] };

const dateTime = (value: string) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "미정";
const mapSearchUrl = (name: string) => `https://map.naver.com/p/search/${encodeURIComponent(name)}`;

export default function PlannerPage() {
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [showPlaceForm, setShowPlaceForm] = useState(false);

  const load = async () => {
    const response = await fetch("/api/planner", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    if (!response.ok) throw new Error("일정을 불러오지 못했습니다.");
    setPlanner(await response.json()); setAuthenticated(true);
  };
  useEffect(() => { void load().catch((error: Error) => setMessage(error.message)); }, []);

  const submit = async (body: object) => {
    const response = await fetch("/api/planner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
    setPlanner(data); setMessage("저장했어요 ✨");
  };
  const patchPlace = async (placeId: number, body: object) => {
    const response = await fetch("/api/planner", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, ...body }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "수정하지 못했습니다.");
    setPlanner(data); setMessage("계획을 반영했어요 ✨");
  };

  const groups = useMemo(() => ({
    관광지: planner?.places.filter((place) => place.category === "관광지") ?? [],
    음식점: planner?.places.filter((place) => place.category === "음식점") ?? [],
  }), [planner]);

  if (authenticated === null) return <main className="loading">속초 계획을 불러오는 중…</main>;
  if (authenticated === false) return <LoginScreen onSuccess={load} />;
  if (!planner) return <main className="loading">속초 계획을 불러오는 중…</main>;
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">SATURDAY TRIP · SOKCHO</p>
        <h1>🧳 속초 당일치기</h1>
        <p>우리 둘이 고르고, 시간표를 채우고, 후기 근거까지 남기는 작은 여행 플래너</p>
        <div className="hero-actions"><a href="#route">일정 짜기</a><a href="#rubric">맛집 루브릭</a></div>
      </header>
      {message && <p className="toast" role="status">{message}</p>}

      <section id="route" className="section-head">
        <div><p className="eyebrow">OUR LIST</p><h2>가고 싶은 곳</h2></div>
        <button className="primary" onClick={() => setShowPlaceForm((value) => !value)}>+ 장소 추가</button>
      </section>
      {showPlaceForm && <PlaceForm onSubmit={async (body) => { await submit(body); setShowPlaceForm(false); }} />}

      <div className="grid">
        {(["관광지", "음식점"] as const).map((category) => <section className="category" key={category}>
          <h2>{category === "관광지" ? "🌊 관광지" : "🍜 음식점"}</h2>
          <div className="cards">
            {groups[category].map((place) => <PlaceCard key={place.id} place={place} comments={planner.comments.filter((comment) => comment.placeId === place.id)} onComment={submit} onPatch={patchPlace} onEvaluation={submit} />)}
            {groups[category].length === 0 && <p className="empty">아직 없어요. 첫 후보를 추가해보세요.</p>}
          </div>
        </section>)}
      </div>

      <section id="rubric" className="rubric">
        <p className="eyebrow">REVIEW RUBRIC</p><h2>맛집 비교는 100점으로</h2>
        <p className="muted">서로 다른 지도 2곳 이상에서 최신 근거를 확인한 뒤 비교합니다. 플랫폼마다 평점·리뷰 수 기준이 달라 단순 평균으로 결정하지 않아요.</p>
        <div className="rubric-grid">
          <div><strong>교차 확인 · 30</strong><span>네이버·Google·카카오 중 확인 플랫폼 수와 평점 일관성</span></div>
          <div><strong>리뷰 규모 · 15</strong><span>합산 리뷰 수는 신뢰도 보조 지표로만 반영</span></div>
          <div><strong>최신성 · 15</strong><span>확인일 14일 이내를 우선</span></div>
          <div><strong>후기 내용 · 25</strong><span>맛·서비스·분위기·가성비와 반복 부정 신호</span></div>
          <div><strong>방문 가능성 · 15</strong><span>대기·예약·속초아이/시장 동선</span></div>
        </div>
        <p className="fine">추천선은 75점 이상 + 하드 필터 PASS입니다. 영업/브레이크타임, 예약, 최근 반복 위생 이슈, 허용 대기시간, 동선 중 하나라도 불명확하면 HOLD로 두고 출발 전 다시 확인하세요. 입력값에는 플랫폼 링크·리뷰 수·확인일·반복 후기를 근거 메모로 남겨주세요.</p>
      </section>

      <section className="global-comments"><h2>💬 여행 메모</h2><CommentForm onSubmit={(body) => submit({ action: "comment", ...body, placeId: null })} />
        <div className="comments">{planner.comments.filter((comment) => comment.placeId == null).map((comment) => <CommentView key={comment.id} comment={comment} />)}</div>
      </section>
    </main>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => Promise<void> }) { const [error, setError] = useState(""); const [saving, setSaving] = useState(false); return <main className="login-screen"><form onSubmit={async (event) => { event.preventDefault(); const password = String(new FormData(event.currentTarget).get("password")); setSaving(true); setError(""); const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); setSaving(false); if (!response.ok) { setError("비밀번호를 확인해주세요."); return; } await onSuccess(); }}><p className="eyebrow">PRIVATE TRIP SPACE</p><h1>🧳 속초 플래너</h1><p>우리의 여행 노트예요. 비밀번호를 입력해주세요.</p><input name="password" type="password" required autoFocus placeholder="공유 비밀번호" /><button className="primary" disabled={saving}>{saving ? "확인 중" : "들어가기"}</button>{error && <small>{error}</small>}</form></main>; }

function PlaceForm({ onSubmit }: { onSubmit: (body: Record<string, string>) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await onSubmit({ action: "place", category: String(form.get("category")), name: String(form.get("name")), mapUrl: String(form.get("mapUrl")) || mapSearchUrl(String(form.get("name"))), notes: String(form.get("notes")), planAt: String(form.get("planAt")) }); } finally { setSaving(false); } };
  return <form className="place-form" onSubmit={submit}><select name="category" defaultValue="음식점"><option>관광지</option><option>음식점</option></select><input name="name" required placeholder="장소명" /><input name="mapUrl" type="url" placeholder="네이버지도 링크 (비우면 검색 링크 자동 생성)" /><input name="planAt" type="datetime-local" /><input name="notes" placeholder="메모·추천 메뉴·예약 정보" /><button className="primary" disabled={saving}>{saving ? "저장 중" : "저장"}</button></form>;
}

function PlaceCard({ place, comments, onComment, onPatch, onEvaluation }: { place: Place; comments: Comment[]; onComment: (body: object) => Promise<void>; onPatch: (id: number, body: object) => Promise<void>; onEvaluation: (body: object) => Promise<void> }) {
  const [editing, setEditing] = useState(false); const [evaluating, setEvaluating] = useState(false);
  const score = place.evaluation ? calculateReviewScore(place.evaluation) : null;
  return <article className="card"><div className="card-top"><div><span className="plan-time">{dateTime(place.planAt)}</span><h3>{place.name}</h3></div><a className="map-link" href={place.mapUrl} target="_blank" rel="noreferrer">네이버지도 ↗</a></div>
    <p>{place.notes || "메모를 남겨보세요."}</p>
    {score?.score != null && <p className="score"><b>{score.score}점</b><span>리뷰 신뢰도 {score.confidence} · {score.reviewCount.toLocaleString()}건</span></p>}
    <div className="card-actions"><button onClick={() => setEditing((value) => !value)}>일정/메모</button>{place.category === "음식점" && <button onClick={() => setEvaluating((value) => !value)}>리뷰 평가</button>}</div>
    {editing && <EditPlace place={place} onSave={async (body) => { await onPatch(place.id, body); setEditing(false); }} />}
    {evaluating && <EvaluationForm place={place} onSave={async (metrics) => { await onEvaluation({ action: "evaluation", placeId: place.id, metrics }); setEvaluating(false); }} />}
    <div className="comments">{comments.map((comment) => <CommentView key={comment.id} comment={comment} />)}</div>
    <CommentForm onSubmit={(body) => onComment({ action: "comment", ...body, placeId: place.id })} compact />
  </article>;
}

function EditPlace({ place, onSave }: { place: Place; onSave: (body: { notes: string; planAt: string }) => Promise<void> }) { return <form className="inline-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onSave({ notes: String(form.get("notes")), planAt: String(form.get("planAt")) }); }}><input name="planAt" type="datetime-local" defaultValue={place.planAt} /><input name="notes" defaultValue={place.notes} /><button>반영</button></form>; }
function CommentForm({ onSubmit, compact = false }: { onSubmit: (body: { author: string; content: string }) => Promise<void>; compact?: boolean }) { const [saving, setSaving] = useState(false); return <form className={compact ? "comment-form compact" : "comment-form"} onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await onSubmit({ author: String(form.get("author")), content: String(form.get("content")) }); event.currentTarget.reset(); } finally { setSaving(false); } }}><input name="author" placeholder="이름 (기본: 우리)" /><input name="content" required placeholder="메모·후기·의견 남기기" /><button disabled={saving}>{saving ? "…" : "등록"}</button></form>; }
function CommentView({ comment }: { comment: Comment }) { return <div className="comment"><b>{comment.author}</b><span>{comment.content}</span><time>{new Date(comment.createdAt + "Z").toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</time></div>; }
function EvaluationForm({ place, onSave }: { place: Place; onSave: (metrics: Record<string, number | string>) => Promise<void> }) { const values: Record<string, number | string | null | undefined> = place.evaluation ?? {}; const [saving, setSaving] = useState(false); const fields = [["naverRating", "네이버 평점 (0–5)"], ["naverReviews", "네이버 리뷰 수"], ["googleRating", "Google 평점 (0–5)"], ["googleReviews", "Google 리뷰 수"], ["kakaoRating", "카카오 평점 (0–5)"], ["kakaoReviews", "카카오 리뷰 수"], ["food", "음식 (0–100)"], ["service", "서비스 (0–100)"], ["ambience", "분위기 (0–100)"], ["value", "가성비 (0–100)"], ["wait", "대기 (0–100)"], ["itineraryFit", "동선 (0–100)"]] as const; return <form className="evaluation-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const metrics: Record<string, number | string> = Object.fromEntries(fields.map(([name]) => [name, Number(form.get(name) || 0)])); metrics.evidenceNote = String(form.get("evidenceNote")); metrics.verifiedAt = String(form.get("verifiedAt")); setSaving(true); try { await onSave(metrics); } finally { setSaving(false); } }}><p>확인한 값만 입력하고, 근거 메모에 링크·확인일·반복 후기를 남겨주세요.</p><div className="eval-grid">{fields.map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0" max={name.endsWith("Rating") ? "5" : undefined} defaultValue={values[name] ?? ""} /></label>)}</div><input name="verifiedAt" type="date" defaultValue={values.verifiedAt ?? ""} /><input name="evidenceNote" defaultValue={values.evidenceNote ?? ""} placeholder="예: 네이버/Google/Kakao 링크와 반복 후기" /><button disabled={saving}>평가 저장</button></form>; }
