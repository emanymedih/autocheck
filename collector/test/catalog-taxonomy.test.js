import test from "node:test";
import assert from "node:assert/strict";
import { canonicalBody, canonicalEnergyType } from "../src/catalog-taxonomy.js";

test("normalizes global export energy types into Avtocheck filters", () => {
  assert.equal(canonicalEnergyType("Pure Electric"), "Электро");
  assert.equal(canonicalEnergyType("Plug-in Hybrid"), "Подключаемый гибрид (PHEV)");
  assert.equal(canonicalEnergyType("Extended Range"), "Гибрид с увеличителем запаса хода (EREV)");
  assert.equal(canonicalEnergyType("Hybrid"), "Гибрид (HEV)");
  assert.equal(canonicalEnergyType("Gasoline+48V Mild Hybrid System"), "Мягкий гибрид 48V");
  assert.equal(canonicalEnergyType("Gasoline"), "Бензин");
});

test("normalizes English export body types", () => {
  assert.equal(canonicalBody("Sedan"), "Седан");
  assert.equal(canonicalBody("Hatchback"), "Хэтчбек");
  assert.equal(canonicalBody("SUV"), "SUV");
});
