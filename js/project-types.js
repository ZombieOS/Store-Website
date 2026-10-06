const extensions = Object.freeze({ app: ".zapp", game: ".zgame", package: ".zpackage" });
const names = Object.freeze({ app: "App", game: "Game", package: "Package" });

export function projectExtension(type) { return extensions[type] || ".zapp"; }
export function projectTypeName(type) { return names[type] || "Project"; }
