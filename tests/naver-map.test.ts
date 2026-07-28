import assert from "node:assert/strict";
import test from "node:test";
import { naverSearchTitle } from "../lib/naver-map";

test("extracts a title from Naver Maps search links", () => {
  assert.equal(
    naverSearchTitle("https://map.naver.com/p/search/%EC%86%8D%EC%B4%88%20%EC%A4%91%EC%95%99%EC%8B%9C%EC%9E%A5"),
    "속초 중앙시장",
  );
  assert.equal(
    naverSearchTitle("https://map.naver.com/p?query=%EC%B2%AD%EC%B4%88%EC%88%98%EB%AC%BC%ED%9A%8C"),
    "청초수물회",
  );
});

test("supports the query carried in a Naver Maps URL fragment", () => {
  assert.equal(
    naverSearchTitle("https://map.naver.com/v5/#/search/%EB%B4%89%ED%8F%AC%EB%A8%B8%EA%B5%AC%EB%A6%AC%EC%A7%91"),
    "봉포머구리집",
  );
});

test("does not invent a title from an opaque direct-place URL", () => {
  assert.equal(naverSearchTitle("https://m.place.naver.com/restaurant/11747637/home"), "");
});
