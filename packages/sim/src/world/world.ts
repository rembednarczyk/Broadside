import { World } from "miniplex";
import { type Entity } from "./components";

export type SimWorld = World<Entity>;

export const createWorld = (): SimWorld => new World<Entity>();

/** Entities with a component in id order: iteration order must not depend on internal buckets. */
export const sortedById = <E extends Entity>(items: Iterable<E>): E[] => [...items].sort((a, b) => a.id - b.id);
