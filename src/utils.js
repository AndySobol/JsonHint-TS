const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const { icons, validTypes } = require("./constants");

let colorjs;
try {
	colorjs = require("colorjs.io");
} catch (e) {
	console.warn("colorjs.io not found, using fallback implementations.");
}

// --- Color utils ---

function isColor(value) {
	return /^#([0-9A-Fa-f]{3,8})$/.test(value);
}

function adjustColor(hex, action, percent) {
	if (!isColor(hex)) return hex;
	// If colorjs is available, you can add an implementation based on it.
	if (colorjs) {
		try {
			const col = new colorjs.Color(hex);
			// Here you can use colorjs methods to change the brightness.
		} catch (e) {
			console.error("colorjs error:", e);
		}
	}
	// Fallback implementation:
	const parseComponent = (h) => parseInt(h.length === 1 ? h + h : h, 16);
	let r, g, b;
	if (hex.length === 4) {
		r = parseComponent(hex[1]);
		g = parseComponent(hex[2]);
		b = parseComponent(hex[3]);
	} else {
		r = parseComponent(hex.slice(1, 3));
		g = parseComponent(hex.slice(3, 5));
		b = parseComponent(hex.slice(5, 7));
	}
	const adjustment = Math.round(255 * (percent / 100));
	const apply = (c) => {
		if (action === "lighten") return Math.min(255, c + adjustment);
		if (action === "darken") return Math.max(0, c - adjustment);
		return c;
	};
	const toHex = (c) => ("0" + c.toString(16)).slice(-2);
	return `#${toHex(apply(r))}${toHex(apply(g))}${toHex(apply(b))}`;
}

function mixColors(color1, color2, weight) {
	function hexToRgb(hex) {
		hex = hex.replace("#", "");
		if (hex.length === 3) {
			hex = hex
				.split("")
				.map((x) => x + x)
				.join("");
		}
		const bigint = parseInt(hex, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return { r, g, b };
	}
	function rgbToHex(r, g, b) {
		return (
			"#" +
			[r, g, b]
				.map((x) => {
					const hex = x.toString(16);
					return hex.length === 1 ? "0" + hex : hex;
				})
				.join("")
		);
	}
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);
	const p = weight / 100;
	const r = Math.round((1 - p) * rgb1.r + p * rgb2.r);
	const g = Math.round((1 - p) * rgb1.g + p * rgb2.g);
	const b = Math.round((1 - p) * rgb1.b + p * rgb2.b);
	return rgbToHex(r, g, b);
}

function applyColorModifiers(color, modifiers) {
	let modifiedColor = color;
	if (!Array.isArray(modifiers)) return modifiedColor;
	modifiers.forEach((mod) => {
		const lightenMatch = mod.match(/lighten\((\d+)%\)/);
		const darkenMatch = mod.match(/darken\((\d+)%\)/);
		const alphaMatch = mod.match(/alpha\((\d+)%\)/);
		const mixMatch = mod.match(/mix\((#[0-9A-Fa-f]{3,8}),\s*(\d+)%\)/);
		if (lightenMatch) {
			const amount = parseInt(lightenMatch[1], 10);
			modifiedColor = adjustColor(modifiedColor, "lighten", amount);
		} else if (darkenMatch) {
			const amount = parseInt(darkenMatch[1], 10);
			modifiedColor = adjustColor(modifiedColor, "darken", amount);
		} else if (alphaMatch) {
			const amount = parseInt(alphaMatch[1], 10);
			const alphaHex = Math.round((amount / 100) * 255)
				.toString(16)
				.padStart(2, "0");
			if (modifiedColor.length === 7) {
				modifiedColor = modifiedColor + alphaHex;
			} else if (modifiedColor.length === 9) {
				modifiedColor = modifiedColor.substring(0, 7) + alphaHex;
			}
		} else if (mixMatch) {
			const mixColor = mixMatch[1];
			const weight = parseInt(mixMatch[2], 10);
			modifiedColor = mixColors(modifiedColor, mixColor, weight);
		}
	});
	return modifiedColor;
}

// --- Color conversion utilities ---

function hexToHSL(H) {
	H = H.replace("#", "");
	let r, g, b;
	if (H.length === 3) {
		r = parseInt(H[0] + H[0], 16);
		g = parseInt(H[1] + H[1], 16);
		b = parseInt(H[2] + H[2], 16);
	} else {
		r = parseInt(H.substring(0, 2), 16);
		g = parseInt(H.substring(2, 4), 16);
		b = parseInt(H.substring(4, 6), 16);
	}
	r /= 255;
	g /= 255;
	b /= 255;
	const cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin;
	let h = 0,
		s = 0,
		l = 0;
	if (delta === 0) {
		h = 0;
	} else if (cmax === r) {
		h = ((g - b) / delta) % 6;
	} else if (cmax === g) {
		h = (b - r) / delta + 2;
	} else {
		h = (r - g) / delta + 4;
	}
	h = Math.round(h * 60);
	if (h < 0) h += 360;
	l = (cmax + cmin) / 2;
	s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	s = +(s * 100).toFixed(1);
	l = +(l * 100).toFixed(1);
	return `hsl(${h}, ${s}%, ${l}%)`;
}

function hexToSRGB(hex) {
	return hex;
}

function hexToP3(hex) {
	return hex;
}

function hexToLCH(hex) {
	return hex;
}

// --- Token utils ---

function isComplexType(type, config) {
	return config.complexTypes.includes(type);
}

function findNearestType(node) {
	while (node) {
		const typeNode = jsonc.findNodeAtLocation(node, ["$type"]);
		if (typeNode && typeof typeNode.value === "string" && validTypes.has(typeNode.value)) {
			return typeNode.value;
		}
		node = node.parent;
	}
	return null;
}

function isRelevantToken(tokenString, config) {
	return !config.noisyTokens.some((noisy) => tokenString.includes(noisy));
}

// --- Chain Renderer ---

function renderChain(chain, mapping, config) {
	if (!chain) return "";
	const maxLength = config.maxChainLength || 5;
	let parts = chain.split("→").map((s) => s.trim());
	if (parts.length > maxLength) parts = parts.slice(-maxLength);
	const printed = new Set();
	let result = "";
	for (const part of parts) {
		if (!part || printed.has(part)) continue;
		printed.add(part);
		const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
		if (!match) continue;
		const [_, tokenName, fileLink] = match;
		const tokenDef = mapping[tokenName];
		const tokenIcon = config.showIcons ? icons[tokenDef?.type] || "" : "";
		const relativePath = vscode.workspace.asRelativePath(fileLink.replace("file://", ""));
		result += `${tokenIcon} [${tokenName}](${fileLink})   ${relativePath}\n`;
	}
	return result;
}

// --- Color Preview ---

function getColorPreview(colorValue) {
	if (!isColor(colorValue)) return "";
	const size = 14;
	const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="checkers" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="2" height="2" fill="#ccc"/>
        <rect x="2" y="2" width="2" height="2" fill="#ccc"/>
      </pattern>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#checkers)"/>
    <rect width="${size}" height="${size}" fill="${colorValue}" stroke="#000" stroke-width="0.5"/>
  </svg>`;
	return `![color](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")})`;
}

// --- Gradient Preview ---
function getGradientPreview(gradientValue) {
	if (typeof gradientValue !== "string" || !gradientValue.startsWith("linear-gradient(")) {
		const svg = `<svg width="124" height="20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ff0000"/>
            <stop offset="50%" stop-color="#00ff00"/>
            <stop offset="100%" stop-color="#0000ff"/>
          </linearGradient>
        </defs>
        <rect width="124" height="20" fill="url(#grad)" />
      </svg>`;
		return `![gradient](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")})`;
	}
	let inner = gradientValue.slice("linear-gradient(".length, -1).trim();
	let parts = inner.split(",");
	let angle = parts[0].trim();
	let stops = parts.slice(1).map((s) => s.trim());
	let numericAngle = angle.replace("deg", "");
	let stopsSvg = stops
		.map((stop) => {
			const subparts = stop.split(" ");
			const color = subparts[0];
			const offset = subparts[1] || "0%";
			return `<stop offset="${offset}" stop-color="${color}"/>`;
		})
		.join("\n");
	const svg = `<svg width="124" height="20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" gradientTransform="rotate(${numericAngle})">
        ${stopsSvg}
      </linearGradient>
    </defs>
    <rect width="124" height="20" fill="url(#grad)" />
  </svg>`;
	return `![gradient](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")})`;
}

// --- Color Modifiers Preview ---
function getColorModifiersPreview(modifiedColor, modifiers) {
	// Calculating fuck transformations
	const hsl = hexToHSL(modifiedColor);
	const srgb = hexToSRGB(modifiedColor);
	const p3 = hexToP3(modifiedColor);
	const lch = hexToLCH(modifiedColor);
	const hex = modifiedColor;
	let fillColor = modifiedColor;
	let fillOpacity = 1;
	if (modifiedColor.length === 9) {
		fillColor = modifiedColor.substring(0, 7);
		fillOpacity = (parseInt(modifiedColor.substring(7, 9), 16) / 255).toFixed(2);
	}
	const svg = `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="checkers" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#ccc"/>
        <rect x="4" y="4" width="4" height="4" fill="#ccc"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="200" height="30" fill="url(#checkers)"/>
    <rect x="0" y="0" width="200" height="30" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="#000" stroke-width="0.5"/>
    <text x="5" y="45" font-size="10" fill="#000">HEX: ${hex}</text>
    <text x="5" y="55" font-size="10" fill="#000">HSL: ${hsl}</text>
    <text x="105" y="45" font-size="10" fill="#000">sRGB: ${srgb}</text>
    <text x="105" y="55" font-size="10" fill="#000">P3: ${p3}</text>
    <text x="5" y="65" font-size="10" fill="#000">LCH: ${lch}</text>
  </svg>`;
	return `![colormod](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")})`;
}

module.exports = {
	isColor,
	adjustColor,
	applyColorModifiers,
	mixColors,
	hexToHSL,
	hexToSRGB,
	hexToP3,
	hexToLCH,
	isComplexType,
	findNearestType,
	isRelevantToken,
	renderChain,
	getColorPreview,
	getGradientPreview,
	getColorModifiersPreview,
	icons,
	validTypes,
};