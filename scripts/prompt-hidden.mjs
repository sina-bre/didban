// Reads a line from the terminal without echoing it (for the local postgres superuser password).
const ENTER = new Set(["\r", "\n"]);
const BACKSPACE = new Set(["\u007f", "\b"]);
const CTRL_C = "\u0003";

/** Applies one key press. Returns "done", "cancel" or the updated value. */
function applyKey(value, char) {
  if (ENTER.has(char)) return { done: true, value };
  if (char === CTRL_C) return { cancel: true, value };
  return { value: BACKSPACE.has(char) ? value.slice(0, -1) : value + char };
}

export function promptHidden(question) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error("Interactive terminal required (or set PGPASSWORD).");
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (settle) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      settle();
    };
    function onData(chunk) {
      for (const char of chunk) {
        const next = applyKey(value, char);
        value = next.value;
        if (next.done) return finish(() => resolve(value));
        if (next.cancel) return finish(() => reject(new Error("Cancelled")));
      }
    }
    stdin.on("data", onData);
  });
}
