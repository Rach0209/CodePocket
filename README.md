# CodePocket

휴대폰에서 바로 코드를 작성하고 실행하는 미니 IDE

🚀 **[Try Now → rach0209.github.io/CodePocket](https://rach0209.github.io/CodePocket)**

---

## Languages

| 언어 | 런타임 |
|------|--------|
| ☕ Java | JDK 17 |
| 🟨 JavaScript | Node.js 20 |
| 🐍 Python | 3.12 |
| 🔵 C | GCC 14 |
| 🔷 C++ | GCC 14 |
| 🟣 C# | Mono 6.6 |

## Features

- 줄 번호 · 폰트 크기 조절
- Tab / Shift+Tab 들여쓰기
- Ctrl+Enter 단축키 실행
- 에디터 / 콘솔 비율 드래그 조절
- stdin 입력 지원
- 언어별 코드 자동 저장

## Stack

- Expo ~56 + React Native 0.85 + TypeScript
- Judge0 CE API (코드 실행)
- GitHub Pages 배포

## Run locally

```bash
git clone https://github.com/Rach0209/CodePocket.git
cd CodePocket
npm install --legacy-peer-deps
npx expo start --web
```
