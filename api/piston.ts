const PISTON_URL = 'https://emkc.org/api/v2/piston';

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface Language {
  id: string;
  label: string;
  pistonLanguage: string;
  version: string;
  template: string;
}

export const LANGUAGES: Language[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    pistonLanguage: 'javascript',
    version: '18.15.0',
    template: `// JavaScript
console.log("Hello, World!");
`,
  },
  {
    id: 'java',
    label: 'Java',
    pistonLanguage: 'java',
    version: '15.0.2',
    template: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
  },
  {
    id: 'c',
    label: 'C',
    pistonLanguage: 'c',
    version: '10.2.0',
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
    pistonLanguage: 'c++',
    version: '10.2.0',
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
    pistonLanguage: 'csharp',
    version: '6.12.0',
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
    pistonLanguage: 'python',
    version: '3.10.0',
    template: `# Python
print("Hello, World!")
`,
  },
];

export async function runCode(language: Language, code: string): Promise<RunResult> {
  const filename = getFilename(language);

  const res = await fetch(`${PISTON_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: language.pistonLanguage,
      version: language.version,
      files: [{ name: filename, content: code }],
    }),
  });

  if (!res.ok) throw new Error(`API 오류: ${res.status}`);

  const data = await res.json();
  return {
    stdout: data.run?.stdout ?? '',
    stderr: data.run?.stderr ?? '',
    code: data.run?.code ?? null,
  };
}

function getFilename(lang: Language): string {
  const map: Record<string, string> = {
    javascript: 'main.js',
    java: 'Main.java',
    c: 'main.c',
    'c++': 'main.cpp',
    csharp: 'Main.cs',
    python: 'main.py',
  };
  return map[lang.pistonLanguage] ?? 'main.txt';
}
