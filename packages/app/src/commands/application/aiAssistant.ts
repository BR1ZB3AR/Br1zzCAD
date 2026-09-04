// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, I18n, type IApplication, type ICommand, PubSub } from "@chili3d/core";
import { button, div, span, textarea } from "@chili3d/element";
import { AI_SYSTEM_PROMPT, buildUserPrompt, executeAiActions, parseAiActions } from "../../ai/aiActions";
import { askJSON, getWebGPUBlocker, isWebLLMReady } from "../../ai/webllmEngine";

const EXAMPLE_PROMPTS = [
    "Add a 40x20x10 mm box at the origin",
    "Create a cylinder radius 15 height 40 next to a sphere radius 20",
    "Stack three 20 mm cubes along Z",
];

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

        const addMessage = (text: string, role: "user" | "assistant" | "status" | "error") => {
            const bubble = div(
                {
                    style: {
                        alignSelf: role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        whiteSpace: "pre-wrap",
                        background:
                            role === "user"
                                ? "var(--primary-color)"
                                : role === "error"
                                  ? "color-mix(in srgb, var(--primary-color) 25%, var(--hover-background-color))"
                                  : "var(--hover-background-color)",
                        color: role === "user" ? "var(--title-checked)" : "var(--foreground-color)",
                        opacity: role === "status" ? "0.7" : "1",
                        fontStyle: role === "status" ? "italic" : "normal",
                        border: role === "error" ? "1px solid var(--primary-color)" : "none",
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
        let busy = false;

        const examples = div({
            style: { display: "flex", flexWrap: "wrap", gap: "4px" },
        });
        for (const prompt of EXAMPLE_PROMPTS) {
            const chip = button({
                textContent: prompt.length > 42 ? `${prompt.slice(0, 40)}…` : prompt,
                title: prompt,
                style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    opacity: "0.85",
                },
            });
            chip.onclick = () => {
                if (busy) return;
                input.value = prompt;
                input.focus();
            };
            examples.append(chip);
        }

        const send = async () => {
            const text = input.value.trim();
            if (!text || busy) return;
            busy = true;
            input.value = "";
            sendBtn.disabled = true;
            input.disabled = true;
            if (examples.isConnected) {
                examples.remove();
            }
            addMessage(text, "user");

            const gpuBlocker = getWebGPUBlocker();
            if (gpuBlocker) {
                addMessage(`${I18n.translate("ai.noWebGPU")}\n${gpuBlocker}`, "error");
                busy = false;
                sendBtn.disabled = false;
                input.disabled = false;
                return;
            }

            const status = addMessage(
                isWebLLMReady() ? I18n.translate("ai.thinking") : I18n.translate("ai.loadingModel"),
                "status",
            );

            try {
                const raw = await askJSON(AI_SYSTEM_PROMPT, buildUserPrompt(text, document), (report) => {
                    if (!isWebLLMReady()) {
                        status.textContent = report.text || I18n.translate("ai.loadingModel");
                    }
                });
                status.textContent = I18n.translate("ai.thinking");
                const actions = parseAiActions(raw);
                const result = executeAiActions(document, actions);
                status.remove();
                if (result.created.length > 0) {
                    addMessage(`Created:\n${result.created.map((c) => `• ${c}`).join("\n")}`, "assistant");
                }
                if (result.errors.length > 0) {
                    addMessage(`Errors:\n${result.errors.map((e) => `• ${e}`).join("\n")}`, "error");
                }
                if (result.created.length === 0 && result.errors.length === 0) {
                    addMessage(I18n.translate("ai.noActions"), "assistant");
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                status.remove();
                addMessage(`${message}\n${I18n.translate("ai.retryHint")}`, "error");
            } finally {
                busy = false;
                sendBtn.disabled = false;
                input.disabled = false;
                input.focus();
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
        const tip = span({
            style: { fontSize: "11px", opacity: "0.65" },
            textContent: I18n.translate("ai.capabilities"),
        });

        const content = div(
            { style: { display: "flex", flexDirection: "column", height: "100%", gap: "8px" } },
            tip,
            transcript,
            examples,
            div({ style: { display: "flex", gap: "6px" } }, input, sendBtn),
        );

        PubSub.default.pub("showFloatPanel", {
            title: "command.ai.assistant",
            content,
            width: 360,
            height: 460,
            x: 60,
            y: 80,
        });

        input.focus();
    }
}
