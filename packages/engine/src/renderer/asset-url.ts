/**
 * Where a model file really is. A host that cannot serve .glb files (the ship viewer published as
 * an artifact) loads them itself, as it can, and lists the object URLs under their game paths in
 * `globalThis.__broadsideAssets`; everywhere else the path is used as it is. Loaders name the
 * format themselves (`GLB`), since an object URL carries no extension.
 */
export const assetUrl = (path: string): string => (globalThis as { __broadsideAssets?: Record<string, string> }).__broadsideAssets?.[path] ?? path;

/** Loader options for a binary glTF whatever its URL looks like. */
export const GLB = { pluginExtension: ".glb" } as const;
