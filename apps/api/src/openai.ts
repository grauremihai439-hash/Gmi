import OpenAI from "openai";
import type { ResponseInput, ResponseInputContent } from "openai/resources/responses/responses";
import { config } from "./config.js";
import type { AiMode, Message } from "./data.js";

const client = config.openAiKey ? new OpenAI({ apiKey: config.openAiKey }) : null;

export interface StreamResult {
  text: string;
  imageDataUrl?: string;
  inputTokens: number;
  outputTokens: number;
}

export interface MessageAttachment {
  name: string;
  mimeType: string;
  dataUrl: string;
  purpose: "analyze" | "edit";
}

export async function streamAssistantResponse(
  messages: Message[],
  mode: AiMode,
  onDelta: (delta: string) => void,
  attachment?: MessageAttachment,
): Promise<StreamResult> {
  if (!client) {
    const demo =
      "Demo mode is active. Add an OPENAI_API_KEY on the server to receive live AI responses. The desktop-to-server streaming flow is working correctly.";
    for (const word of demo.split(/(\s+)/)) {
      onDelta(word);
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    return { text: demo, inputTokens: 0, outputTokens: 0 };
  }

  const recentMessages = messages.slice(-30);
  const input: ResponseInput = recentMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (attachment && input.length > 0) {
    const lastMessage = input[input.length - 1];
    if ("role" in lastMessage && lastMessage.role === "user") {
      const content: ResponseInputContent[] = [
        { type: "input_text", text: recentMessages.at(-1)?.content ?? "Analyze this attachment." },
      ];
      if (attachment.mimeType.startsWith("image/")) {
        content.push({ type: "input_image", detail: "auto", image_url: attachment.dataUrl });
      } else {
        content.push({
          type: "input_file",
          filename: attachment.name,
          file_data: attachment.dataUrl,
        });
      }
      lastMessage.content = content;
    }
  }

  const editImage = attachment?.purpose === "edit" && attachment.mimeType.startsWith("image/");
  const stream = await client.responses.create({
    model: mode === "advanced" ? config.advancedModel : config.fastModel,
    input,
    ...(editImage ? {
      tools: [{
        type: "image_generation" as const,
        model: config.imageModel as "gpt-image-1",
        output_format: "png" as const,
        partial_images: 1,
        quality: "auto" as const,
      }],
      tool_choice: { type: "image_generation" as const },
    } : {}),
    stream: true,
    store: false,
    max_output_tokens: 4096,
    safety_identifier: messages[0]?.conversationId,
  });

  let text = "";
  let imageDataUrl: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      text += event.delta;
      onDelta(event.delta);
    }
    if (event.type === "response.image_generation_call.partial_image") {
      imageDataUrl = `data:image/png;base64,${event.partial_image_b64}`;
    }
    if (event.type === "response.completed") {
      inputTokens = event.response.usage?.input_tokens ?? 0;
      outputTokens = event.response.usage?.output_tokens ?? 0;
    }
  }

  if (imageDataUrl && !text) text = "Here is the edited image.";
  return { text, imageDataUrl, inputTokens, outputTokens };
}
