import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createComment, createPlace, createScheduleItem, deletePlace, deleteScheduleItem, listPlanner, saveEvaluation, setPlaceRating, updatePlace, updateScheduleItem } from "@/lib/planner";

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
    createPlace({ category: body.category, name: body.name, mapUrl: body.mapUrl, notes: typeof body.notes === "string" ? body.notes : "", planAt: typeof body.planAt === "string" ? body.planAt : "", planEndAt: typeof body.planEndAt === "string" ? body.planEndAt : "" });
  } else if (body.action === "comment") {
    if (typeof body.content !== "string" || !body.content.trim()) return error("댓글 내용을 입력해주세요.");
    createComment({ placeId: typeof body.placeId === "number" ? body.placeId : null, author: typeof body.author === "string" ? body.author : "우리", content: body.content });
  } else if (body.action === "evaluation") {
    if (typeof body.placeId !== "number") return error("장소를 찾을 수 없습니다.");
    saveEvaluation(body.placeId, body.metrics as Parameters<typeof saveEvaluation>[1]);
  } else if (body.action === "schedule") {
    if (typeof body.startAt !== "string" || typeof body.title !== "string" || !body.startAt.trim() || !body.title.trim()) {
      return error("시작 시각과 일정 제목은 필수입니다.");
    }
    createScheduleItem({
      startAt: body.startAt,
      endAt: typeof body.endAt === "string" ? body.endAt : "",
      title: body.title,
      transport: typeof body.transport === "string" ? body.transport : "",
      notes: typeof body.notes === "string" ? body.notes : "",
    });
  } else {
    return error("지원하지 않는 요청입니다.");
  }
  return NextResponse.json(listPlanner(), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) return error("로그인이 필요합니다.", 401);
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "schedule") {
    if (typeof body.id !== "number" || typeof body.startAt !== "string" || typeof body.title !== "string" || !body.startAt.trim() || !body.title.trim()) {
      return error("수정할 일정의 시작 시각과 제목은 필수입니다.");
    }
    if (!updateScheduleItem(body.id, {
      startAt: body.startAt,
      endAt: typeof body.endAt === "string" ? body.endAt : "",
      title: body.title,
      transport: typeof body.transport === "string" ? body.transport : "",
      notes: typeof body.notes === "string" ? body.notes : "",
    })) return error("수정할 일정을 찾을 수 없습니다.", 404);
  } else {
    if (typeof body.placeId !== "number") return error("장소를 찾을 수 없습니다.");
    if (body.rating !== undefined) {
      if (typeof body.rating !== "number" || !setPlaceRating(body.placeId, body.rating)) return error("별점은 0~5 사이 정수여야 합니다.");
    } else {
      updatePlace(body.placeId, {
        notes: typeof body.notes === "string" ? body.notes : undefined,
        planAt: typeof body.planAt === "string" ? body.planAt : undefined,
        planEndAt: typeof body.planEndAt === "string" ? body.planEndAt : undefined,
      });
    }
  }
  return NextResponse.json(listPlanner());
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) return error("로그인이 필요합니다.", 401);
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "number" ? body.id : null;
  if (id == null) return error("삭제할 항목을 찾을 수 없습니다.");
  const deleted = body.action === "place" ? deletePlace(id) : body.action === "schedule" ? deleteScheduleItem(id) : false;
  if (!deleted) return error("삭제할 항목을 찾을 수 없습니다.", 404);
  return NextResponse.json(listPlanner());
}
