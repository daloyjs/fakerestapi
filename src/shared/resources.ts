import {
  RESOURCES,
  seededCountFor,
  type ResourceDef,
  type Sample,
} from "../resources.js";
import { enrichSample } from "../relationships.js";

export function listFor(def: ResourceDef): Sample[] {
  const count = seededCountFor(def);
  const items: Sample[] = [];
  for (let index = 1; index <= count; index++) {
    items.push(enrichSample(def.name, def.sample(index)));
  }
  return items;
}

export function getById(def: ResourceDef, id: number): Sample | null {
  if (!Number.isInteger(id) || id < 1) return null;
  const max = seededCountFor(def);
  if (id > max) return null;
  return enrichSample(def.name, def.sample(id));
}

export function resourceNamed(name: string): ResourceDef {
  const def = RESOURCES.find((resource) => resource.name === name);
  if (!def) throw new Error(`Unknown resource: ${name}`);
  return def;
}