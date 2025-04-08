import * as vscode from "vscode";
import * as path from "path";
import { TokenResolver } from "./TokenParser";

export class TokenDetailsView {
	public static currentPanel: TokenDetailsView | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, tokenKey: string, tokenResolver: TokenResolver) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this.update(tokenKey, tokenResolver);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public static createOrShow(extensionUri: vscode.Uri, tokenKey: string, tokenResolver: TokenResolver): void {
		const column = vscode.ViewColumn.One;
		if (TokenDetailsView.currentPanel) {
			TokenDetailsView.currentPanel._panel.reveal(column);
			TokenDetailsView.currentPanel.update(tokenKey, tokenResolver);
		} else {
			const panel = vscode.window.createWebviewPanel("tokenDetails", "Token Details", column, {
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
			});
			TokenDetailsView.currentPanel = new TokenDetailsView(panel, extensionUri, tokenKey, tokenResolver);
		}
	}

	public update(tokenKey: string, tokenResolver: TokenResolver): void {
		const resolved = tokenResolver.resolveToken(`{${tokenKey}}`);
		this._panel.webview.html = this.getHtmlForWebview(tokenKey, resolved);
	}

	private getHtmlForWebview(tokenKey: string, resolved: any): string {
		const style = `
      <style>
        body { font-family: sans-serif; padding: 16px; }
        .header { font-size: 20px; margin-bottom: 12px; }
        .section { margin-bottom: 16px; }
        .label { font-weight: bold; margin-bottom: 4px; }
        pre { background-color: #f3f3f3; padding: 8px; border-radius: 4px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; }
        th { background-color: #eee; }
      </style>
    `;
		const resultSection = resolved.finalValue
			? `
      <div class="section">
        <div class="label">Result:</div>
        <pre>${resolved.finalValue}</pre>
      </div>
    `
			: "";

		const chainSection = resolved.chain
			? `
      <div class="section">
        <div class="label">Resolution Chain:</div>
        <pre>${resolved.chain}</pre>
      </div>
    `
			: "";

		let propsSection = "";
		if (resolved.props) {
			propsSection = `
      <div class="section">
        <div class="label">Properties:</div>
        <table>
          <tr>
            <th>Property</th><th>Value</th><th>Resolved</th><th>Chain</th>
          </tr>
          ${Object.entries(resolved.props)
						.map(
							([prop, data]: [string, any]) => `
              <tr>
                <td>${prop}</td>
                <td>${data.value}</td>
                <td>${data.result}</td>
                <td>${data.chain}</td>
              </tr>`
						)
						.join("")}
        </table>
      </div>
      `;
		}

		return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Token Details</title>
        ${style}
      </head>
      <body>
        <div class="header">Details for token: ${tokenKey}</div>
        ${resultSection}
        ${chainSection}
        ${propsSection}
      </body>
      </html>`;
	}

	public dispose(): void {
		TokenDetailsView.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}