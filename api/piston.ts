const JUDGE0_URL = 'https://ce.judge0.com';

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface Language {
  id: string;
  label: string;
  judge0Id: number;
  template: string;
}

export const LANGUAGES: Language[] = [
  {
    id: 'java',
    label: 'Java',
    judge0Id: 91,
    template: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    judge0Id: 97,
    template: `// JavaScript
console.log("Hello, World!");
`,
  },
  {
    id: 'c',
    label: 'C',
    judge0Id: 103,
    template: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`,
  },
  {
    id: 'cpp',
    label: 'C++',
    judge0Id: 105,
    template: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`,
  },
  {
    id: 'csharp',
    label: 'C#',
    judge0Id: 51,
    template: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}
`,
  },
  {
    id: 'python',
    label: 'Python',
    judge0Id: 100,
    template: `# Python
print("Hello, World!")
`,
  },
];

export async function runCode(language: Language, code: string): Promise<RunResult> {
  const res = await fetch(`${JUDGE0_URL}/submissions?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language_id: language.judge0Id,
      source_code: code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API 오류: ${res.status} — ${body}`);
  }

  const data = await res.json();

  const decode = (s: string | null) => {
    if (!s) return '';
    try { return atob(s); } catch { return s; }
  };

  const stdout = decode(data.stdout);
  const stderr = decode(data.stderr);
  const compileErr = decode(data.compile_output);

  return {
    stdout,
    stderr: compileErr || stderr,
    code: data.status?.id === 3 ? 0 : 1,
  };
}
