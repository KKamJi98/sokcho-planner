import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createComment, createPlace, listPlanner, saveEvaluation, updatePlace } from "@/lib/planner";

export const runtime = "nodejs";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!(await isAuthenticated())) return error("로그인이 필요합니다.", 401);
  return NextResponse.json(listPlanner());
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return error("로그인이 필요합니다.", 401);
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "place") {
    if ((body.category !== "관광지" && body.category !== "음식점") || typeof body.name !== "string" || typeof body.mapUrl !== "string") {
      return error("카테고리, 장소명, 네이버지도 링크는 필수입니다.");
    }
    if (!body.name.trim() || !body.mapUrl.trim()) return error("장소명과 네이버지도 링크를 입력해주세요.");
    createPlace({ category: body.category, name: body.name, mapUrl: body.mapUrl, notes: typeof body.notes === "string" ? body.notes : "", planAt: typeof body.planAt === "string" ? body.planAt : "" });
  } else if (body.action === "comment") {
    if (typeof body.content !== "string" || !body.content.trim()) return error("댓글 내용을 입력해주세요.");
    createComment({ placeId: typeof body.placeId === "number" ? body.placeId : null, author: typeof body.author === "string" ? body.author : "우리", content: body.content });
  } else if (body.action === "evaluation") {
    if (typeof body.placeId !== "number") return error("장소를 찾을 수 없습니다.");
    saveEvaluation(body.placeId, body.metrics as Parameters<typeof saveEvaluation>[1]);
  } else {
    return error("지원하지 않는 요청입니다.");
  }
  return NextResponse.json(listPlanner(), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) return error("로그인이 필요합니다.", 401);
  const body = await request.json() as Record<string, unknown>;
  if (typeof body.placeId !== "number") return error("장소를 찾을 수 없습니다.");
  updatePlace(body.placeId, { notes: typeof body.notes === "string" ? body.notes : undefined, planAt: typeof body.planAt === "string" ? body.planAt : undefined });
  return NextResponse.json(listPlanner());
}
