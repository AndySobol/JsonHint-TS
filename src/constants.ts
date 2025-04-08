export const icons: { [key: string]: string } = {
	color: "🎨",
	sizing: "📏",
	spacing: "↔️",
	borderRadius: "🟣",
	borderWidth: "➖",
	dimension: "📐",
	typography: "🔤",
	boxShadow: "☁️",
	opacity: "🌫️",
	number: "#️⃣",
	boolean: "✔️",
	text: "📝",
	other: "⚙️",
};

export const validTypes: Set<string> = new Set(["color", "typography", "fontFamilies", "fontFamily", "fontWeights", "fontWeight", "fontSizes", "fontSize", "lineHeights", "lineHeight", "letterSpacing", "paragraphSpacing", "textCase", "textDecoration", "dimension", "number", "border", "boxShadow", "borderRadius", "borderWidth", "spacing", "sizing", "boolean", "text", "other", "opacity", "composition"]);