# 🌙 우리 아이 잠자리 동화

아이 **이름 · 나이 · 좋아하는 것 · 오늘 있었던 일(선택)** 을 적고 **"동화 만들기"** 를 누르면,
Claude Sonnet 5.5가 소리 내어 읽으면 3분쯤 걸리는 포근한 한국어 동화를 **5장면 그림책**으로 지어 줘요.

- 글자가 바로바로 나타나요 (스트리밍)
- 장면마다 OpenAI 그림 AI가 수채화 그림을 그려 줘요 (장면마다 몇십 초 걸려요)
- ◀ ▶ 버튼으로 책장을 넘겨요
- **🔊 읽어주기** 를 누르면 OpenAI 목소리(sage)가 한 장씩 다정하게 읽고 저절로 다음 장으로 넘어가요
- 잠자리에 맞춘 어두운 밤하늘 화면

---

## 📁 파일이 하는 일

| 파일 | 하는 일 |
|---|---|
| `app/page.tsx` | 화면 (입력칸, 버튼, 동화, 읽어주기) |
| `app/globals.css` | 꾸미기 (DESIGN.md 색·모양) |
| `app/api/story/route.ts` | Claude에게 동화를 부탁하는 서버 코드 |
| `app/api/image/route.ts` | OpenAI에게 장면 그림을 부탁하는 서버 코드 |
| `.env` | 내 API 키 2개 (**GitHub에 안 올라가요**) |
| `.env.example` | `.env` 를 어떻게 쓰는지 보여주는 예시 |

---

## 💻 내 컴퓨터에서 실행하기

1. `.env` 파일을 열고 키 2개를 `=` 뒤에 붙여 넣어요.
   - `ANTHROPIC_API_KEY=` ← Anthropic 키 (동화 글)
   - `OPENAI_API_KEY=` ← OpenAI 키 (그림). https://platform.openai.com/api-keys 에서 만들어요.
     결제 카드 등록이 필요하고, 처음엔 **조직 인증(Verification)** 을 하라고 할 수도 있어요
     (https://platform.openai.com/settings/organization/general).
   - OpenAI 키가 없어도 동화 글은 나와요. 그림 자리에 "그림을 불러오지 못했어요"가 보여요.
2. 터미널에서 이 폴더로 와서 아래 명령을 입력해요.
   (Node.js는 `~/.local/node-v26.13.0-darwin-arm64` 에 설치되어 있어요.)

```bash
export PATH="$HOME/.local/node-v26.13.0-darwin-arm64/bin:$PATH"
```

```bash
npm install
```

```bash
npm run dev
```

3. 브라우저에서 http://localhost:3000 을 열어요.
4. 끝낼 때는 터미널에서 `Ctrl + C` 를 눌러요.

---

## 🚀 인터넷에 올리기 (GitHub → Vercel)

코드는 이미 GitHub에 올라가 있어요. 이제 **Vercel** 이 GitHub에서 코드를 가져가 웹사이트로 만들어 줘요.
한 번 연결해 두면, 앞으로 GitHub에 코드를 올릴 때마다 Vercel이 **알아서 다시 만들어 줘요.**

### 1단계 · Vercel 가입하기
1. https://vercel.com 에 들어가요.
2. **Sign Up** → **Continue with GitHub** 를 눌러요.
3. GitHub가 "Vercel이 접근해도 될까요?" 하고 물으면 **Authorize** 를 눌러요.

### 2단계 · 프로젝트 가져오기
1. Vercel 화면에서 **Add New…** → **Project** 를 눌러요.
2. GitHub 저장소 목록에서 이 저장소를 찾아 **Import** 를 눌러요.
   - 목록에 안 보이면 **Adjust GitHub App Permissions** 를 눌러 이 저장소를 허용해 줘요.
3. **Framework Preset** 이 **Next.js** 로 되어 있는지 확인해요. (보통 자동으로 돼요. 다른 칸은 그대로 두세요.)

### 3단계 · API 키 넣기 (가장 중요해요!)
`.env` 파일은 GitHub에 안 올라가니까, Vercel에 키를 따로 알려 줘야 해요.

1. 같은 화면의 **Environment Variables** 를 펼쳐요.
2. 이렇게 적어요.
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: 내 API 키 (`sk-ant-` 로 시작하는 긴 글자)
3. **Add** 를 눌러요.
4. 같은 방법으로 하나 더 넣어요.
   - **Key**: `OPENAI_API_KEY`
   - **Value**: OpenAI 키 (`sk-` 로 시작)

> 이미 배포한 뒤에 키를 추가했다면: 프로젝트 → **Settings** → **Environment Variables** 에서 추가하고,
> **Deployments** 탭 맨 위 항목의 `⋯` → **Redeploy** 를 눌러야 적용돼요.

### 4단계 · 배포하기
1. **Deploy** 버튼을 눌러요.
2. 1~2분 기다리면 축하 화면이 나와요 🎉
3. **Continue to Dashboard** → 위쪽 **Domains** 에 있는 주소(예: `xxx.vercel.app`)를 누르면 내 웹사이트가 열려요!

### 나중에 고칠 때
코드를 고치고 GitHub에 올리면(push) Vercel이 1~2분 뒤 자동으로 새 버전을 보여줘요.

---

## 🆘 문제가 생겼을 때

| 증상 | 해결 |
|---|---|
| "API 키가 올바르지 않아요" | Vercel → 프로젝트 → **Settings** → **Environment Variables** 에서 키를 다시 확인하고, **Deployments** 탭에서 맨 위 항목의 `⋯` → **Redeploy** |
| 동화가 중간에 끊겨요 | 잠시 뒤 다시 눌러 보세요 |
| 그림 자리에 "그림을 불러오지 못했어요" | `OPENAI_API_KEY` 가 있는지, OpenAI 결제·조직 인증이 됐는지 확인해요 |
| 읽어주기 소리가 안 나요 | 휴대폰 무음 모드를 끄고, `OPENAI_API_KEY` 가 있는지 확인해요 |
| 키를 실수로 GitHub에 올렸어요 | https://console.anthropic.com 에서 그 키를 **바로 삭제**하고 새 키를 만드세요 |

---

## ⚙️ 기술 메모
- Next.js 16 (App Router) + TypeScript
- 모델: `claude-sonnet-5-5` (스트리밍)
- 안전 필터가 동화를 거절하면 다른 모델이 이어서 쓰도록 `fallbacks: "default"` 를 켜 두었어요
- 그림: OpenAI `gpt-image-2.5-flare`, 1024×1024, `quality: "medium"` — 동화 1편에 그림 5장
- 읽어주기: OpenAI `gpt-4o-mini-tts`, 목소리 `sage` (바꾸려면 `app/api/speech/route.ts` 의 `VOICE`) — 장마다 따로 만들어 요금이 들어요
- ⚠️ 로그인이 없어서 주소를 아는 사람은 누구나 내 크레딧으로 동화·그림을 만들 수 있어요. 주소는 믿는 사람에게만!
