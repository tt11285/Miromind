import { describe, expect, it } from "vitest";
import { parseJsonLines } from "./streamClient";

describe("parseJsonLines", () => {
  it("parses chunked newline-delimited JSON", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("{\"type\":\"run-started\"}\n{\"type\":"));
        controller.enqueue(encoder.encode("\"run-completed\"}\n"));
        controller.close();
      }
    });

    const events = [];
    for await (const event of parseJsonLines(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "run-started" }, { type: "run-completed" }]);
  });

  it("parses a final line even without a trailing newline", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("{\"type\":\"run-failed\"}"));
        controller.close();
      }
    });

    const events = [];
    for await (const event of parseJsonLines(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "run-failed" }]);
  });
});
