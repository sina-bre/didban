/**
 * Line prompts for the CLI. On a terminal, keys are read in raw mode: visible answers are echoed,
 * hidden ones are not. Piped input (scripts, CI) is read line by line. Passwords are never taken
 * from argv (spec §11). Raw mode instead of readline: readline with a muted output dropped input
 * in the Windows console.
 */
export function createPrompter() {
  const terminal = Boolean(process.stdin.isTTY);
  const piped = terminal ? undefined : readPipedLines();

  async function ask(question: string, hidden = false): Promise<string> {
    process.stdout.write(question);
    if (!piped) return readTerminalLine(hidden);
    const answer = (await piped).shift();
    process.stdout.write("\n");
    if (answer === undefined) throw new Error("Input ended before all answers were given.");
    return answer;
  }

  return { ask, close: () => process.stdin.pause(), terminal };
}

async function readPipedLines(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

const ENTER = new Set(["\r", "\n"]);
const BACKSPACE = new Set(["\u007f", "\b"]);
const CTRL_C = "\u0003";
const ESC = "\u001b";
// Terminal escape sequences: bracketed-paste markers (ESC[200~ … ESC[201~, which PowerShell turns
// on) and keys like arrows (ESC[A, ESCOA). Removed so the pasted text itself is kept.
const ESCAPES = new RegExp(`${ESC}(\\[[0-9;?]*[A-Za-z~]|O[A-Za-z])`, "g");

/** Applies one typed character; returns the new value, or null when Enter ends the line. */
function applyKey(value: string, char: string, hidden: boolean): string | null {
  if (ENTER.has(char)) return null;
  if (char === CTRL_C) {
    process.stdout.write("\nCancelled. Nothing was created.\n");
    process.exit(130);
  }
  if (BACKSPACE.has(char)) {
    if (value && !hidden) process.stdout.write("\b \b");
    return [...value].slice(0, -1).join("");
  }
  if (char < " ") return value;
  if (!hidden) process.stdout.write(char);
  return value + char;
}

function readTerminalLine(hidden: boolean): Promise<string> {
  const stdin = process.stdin;
  return new Promise((resolve) => {
    let value = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk.replace(ESCAPES, "")) {
        const next = applyKey(value, char, hidden);
        if (next === null) return finish();
        value = next;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}
