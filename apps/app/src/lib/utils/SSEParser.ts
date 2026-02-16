export type SSEEvent = {
  event?: string;
  data: string;
};

export class SSEParser {
  private buffer = "";
  private decoder = new TextDecoder();

  /**
   * Process a chunk of bytes from the stream.
   * Returns an array of parsed events found in this chunk.
   */
  processChunk(chunk: Uint8Array): SSEEvent[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const parts = this.buffer.split("\n\n");
    this.buffer = parts.pop() || "";

    const events: SSEEvent[] = [];

    for (const part of parts) {
      const lines = part.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));

      if (!dataLine) continue;

      const eventType = eventLine?.replace(/^event:\s*/, "").trim();
      const dataRaw = dataLine.replace(/^data:\s*/, "").trim();

      events.push({
        event: eventType,
        data: dataRaw,
      });
    }

    return events;
  }

  /**
   * Resets the parser state.
   */
  reset() {
    this.buffer = "";
  }
}
