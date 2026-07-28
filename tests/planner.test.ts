import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("deletes a place and its attached comments", async () => {
  const databasePath = path.join("/tmp", `sokcho-planner-delete-${process.pid}.db`);
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
  process.env.DATABASE_PATH = databasePath;
  const { createComment, createPlace, deletePlace, listPlanner } = await import("../lib/planner");
  const placeId = createPlace({
    category: "음식점",
    name: "삭제 테스트 식당",
    mapUrl: "https://map.naver.com/p/search/test",
    notes: "",
    planAt: "",
  });
  createComment({ placeId, author: "우리", content: "삭제될 메모" });

  assert.equal(deletePlace(placeId), true);
  const planner = listPlanner();
  assert.equal(planner.places.some((place) => place.id === placeId), false);
  assert.equal(planner.comments.some((comment) => comment.placeId === placeId), false);
});

test("records removal of a seeded candidate so it is not seeded again", async () => {
  const { getDb } = await import("../lib/db");
  const { deletePlace, listPlanner } = await import("../lib/planner");
  const candidate = listPlanner().places.find((place) => place.name === "단천식당 속초");
  assert.ok(candidate);

  assert.equal(deletePlace(candidate.id), true);
  assert.equal(listPlanner().places.some((place) => place.name === "단천식당 속초"), false);
  const tombstone = getDb().prepare("SELECT name FROM deleted_seed_places WHERE category = ? AND name = ?").get("음식점", "단천식당 속초") as { name?: string } | undefined;
});

test("adds and removes a timetable item", async () => {
  const { createScheduleItem, deleteScheduleItem, listPlanner } = await import("../lib/planner");
  const itemId = createScheduleItem({
    startAt: "2026-08-01T08:50",
    endAt: "2026-08-01T11:20",
    title: "속초행 버스",
    transport: "고속버스",
    notes: "출발 터미널 확인",
  });
  assert.ok(listPlanner().scheduleItems.some((item) => item.id === itemId && item.title === "속초행 버스"));
  assert.equal(deleteScheduleItem(itemId), true);
  assert.equal(listPlanner().scheduleItems.some((item) => item.id === itemId), false);
});

test("stores a personal star rating on a place", async () => {
  const { listPlanner, setPlaceRating } = await import("../lib/planner");
  const place = listPlanner().places.find((item) => item.name === "속초아이 대관람차");
  assert.ok(place);
  assert.equal(setPlaceRating(place.id, 4), true);
  assert.equal(listPlanner().places.find((item) => item.id === place.id)?.personalRating, 4);
});
