// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, I18n, type IApplication, type ICommand, PubSub } from "@chili3d/core";
import { button, div, span, textarea } from "@chili3d/element";
import { AI_SYSTEM_PROMPT, executeAiActions, parseAiActions } from "../../ai/aiActions";
import { askJSON } from "../../ai/webllmEngine";

@command({
    key: "ai.assistant",
    icon: "icon-ai",
    isApplicationCommand: true,
})
export class AiAssistantCommand implements ICommand {
    async execute(app: IApplication): Promise<void> {
        let document = app.activeView?.document;
        if (!document) {
            document = await app.newDocument("Untitled");
            PubSub.default.pub("displayHome", false);
        }

        const transcript = div({
            style: {
                flex: "1",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "4px 2px",
                fontSize: "12px",
            },
        });

        const addMessage = (text: string, role: "user" | "assistant" | "status") => {
            const bubble = div(
                {
                    style: {
                        alignSelf: role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        whiteSpace: "pre-wrap",
                        background:
                            role === "user" ? "var(--primary-color)" : "var(--hover-background-color)",
                        color: role === "user" ? "var(--title-checked)" : "var(--foreground-color)",
                        opacity: role === "status" ? "0.7" : "1",
                        fontStyle: role === "status" ? "italic" : "normal",
                    },
                },
                text,
            );
            transcript.append(bubble);
            transcript.scrollTop = transcript.scrollHeight;
            return bubble;
        };

        const input = textarea({
            placeholder: I18n.translate("ai.placeholder"),
            rows: 2,
            style: { flex: "1", resize: "none", fontFamily: "inherit", fontSize: "12px" },
        });

        const sendBtn = button({ textContent: I18n.translate("ai.send") });

        const send = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            sendBtn.disabled = true;
            addMessage(text, "user");
            const status = addMessage(I18n.translate("ai.loadingModel"), "status");

            try {
                const raw = await askJSON(AI_SYSTEM_PROMPT, text, (report) => {
                    status.textContent = report.text || I18n.translate("ai.loadingModel");
                });
                status.textContent = I18n.translate("ai.thinking");
                const actions = parseAiActions(raw);
                const result = executeAiActions(document, actions);
                status.remove();
                if (result.created.length > 0) {
                    addMessage(`Created:\n${result.created.map((c) => `• ${c}`).join("\n")}`, "assistant");
                }
                if (result.errors.length > 0) {
                    addMessage(`Errors:\n${result.errors.map((e) => `• ${e}`).join("\n")}`, "assistant");
                }
                if (result.created.length === 0 && result.errors.length === 0) {
                    addMessage("(no actions returned)", "assistant");
                }
            } catch (e) {
                status.textContent = e instanceof Error ? e.message : String(e);
            } finally {
                sendBtn.disabled = false;
            }
        };

        sendBtn.onclick = send;
        input.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
            }
        };

        addMessage(I18n.translate("ai.ready"), "status");

        const content = div(
            { style: { display: "flex", flexDirection: "column", height: "100%", gap: "8px" } },
            transcript,
            div({ style: { display: "flex", gap: "6px" } }, input, sendBtn),
        );

        PubSub.default.pub("showFloatPanel", {
            title: "command.ai.assistant",
            content,
            width: 340,
            height: 420,
            x: 60,
            y: 80,
        });
    }
}
