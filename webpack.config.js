"use strict";

const path = require("path");

/** @type {import('webpack').Configuration} */
const config = {
	mode: "production", // или "development"
	target: "node", // расширения для VSCode работают в Node.js
	entry: "./extension.js", // точка входа вашего расширения
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2", // требуемый формат для VSCode
	},
	externals: {
		// VSCode предоставляет этот модуль, поэтому его не нужно бандлить
		vscode: "commonjs vscode",
	},
	resolve: {
		extensions: [".js"],
	},
	devtool: "source-map", // для поддержки sourcemaps
	module: {
		rules: [
			{
				test: /\.js$/,
				enforce: "pre",
				use: ["source-map-loader"],
				exclude: /node_modules/,
			},
		],
	},
};

module.exports = config;
