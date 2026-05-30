export async function* parseJsonLines<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line) as T;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    yield JSON.parse(buffer) as T;
  }
}
