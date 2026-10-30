# 🌙 우리 아이 잠자리 동화

아이 **이름 · 나이 · 좋아하는 것 · 오늘 있었던 일(선택)** 을 적고 **"동화 만들기"** 를 누르면,
Claude Sonnet 5.5가 소리 내어 읽으면 3분쯤 걸리는 포근한 한국어 동화를 **5장면 그림책**으로 지어 줘요.

- 글자가 바로바로 나타나요 (스트리밍)
- 장면마다 OpenAI 그림 AI가 수채화 그림을 그려 줘요 (장면마다 몇십 초 걸려요)
- ◀ ▶ 버튼으로 책장을 넘겨요
- **🔊 읽어주기** 를 누르면 OpenAI 목소리(sage)가 한 장씩 다정하게 읽고 저절로 다음 장으로 넘어가요
- 잠자리에 맞춘 옛날 동화집 화면
- **나의 동화 책장**: 만든 동화가 저장되고, 언제든 다시 열어 볼 수 있어요 (Firebase)
  - 로그인 없이도 "손님"으로 저장돼요 (그 기기에서만 보여요)
  - **Google로 로그인**하면 손님 때 만든 동화가 내 계정으로 옮겨 가고, 어느 기기에서나 볼 수 있어요
- **내려받기**: 장면 그림(jpg) · 읽어 준 목소리(mp3) · 동화 글(txt)

---

## 📁 파일이 하는 일

모든 코드는 **TypeScript** (`.ts` / `.tsx`) 예요.

| 파일 | 하는 일 |
|---|---|
| `app/page.tsx` | 화면 (입력칸, 동화책, 읽어주기, 저장·다시 열기·내려받기) |
| `app/globals.css` | 꾸미기 (DESIGN.md 원칙 + 옛날 동화집 느낌) |
| `app/api/story/route.ts` | Claude에게 동화를 부탁하는 서버 코드 |
| `app/api/image/route.ts` | OpenAI에게 장면 그림을 부탁하는 서버 코드 |
| `app/api/speech/route.ts` | OpenAI에게 읽어 주는 목소리를 부탁하는 서버 코드 |
| `app/api/download/route.ts` | Storage 파일을 "내려받기"로 받게 해 주는 서버 코드 |
| `components/AuthBar.tsx` | 로그인 줄 (손님 / Google 로그인 / 로그아웃) |
| `components/Library.tsx` | 나의 동화 책장 (다시 열기 · 지우기) |
| `lib/types.ts` | **저장 구조(모양) 정의** — 무엇을 어디에 저장하는지 |
| `lib/db.ts` | **데이터** 저장·읽기 (Firestore) |
| `lib/files.ts` | **파일** 올리기·내려받기·지우기 (Storage) |
| `lib/stories.ts` | 데이터와 파일을 함께 다루는 일 (파일 올리고 위치 기록, 동화 지우기) |
| `lib/firebase.ts` | Firebase 연결 (설정이 없으면 저장 없이 동작) |
| `lib/useAuth.ts` | 로그인 상태 관리 |
| `lib/models.ts` | 쓰는 AI 모델 이름 모음 |
| `firestore.rules` / `storage.rules` | 보안 규칙 — "자기 책장은 자기만" |
| `.env` | 내 키와 Firebase 설정 (**GitHub에 안 올라가요**) |
| `.env.example` | `.env` 를 어떻게 쓰는지 보여주는 예시 |

---

## 🗄️ 저장 구조: 데이터와 파일을 나눠서 관리해요

| | **데이터** (Firestore) | **파일** (Firebase Storage) |
|---|---|---|
| 무엇 | 글자·숫자·날짜 | 내려받을 수 있는 그림·소리 |
| 예 | 동화 제목, 본문 5장, 아이 정보, 만든 날짜, 파일 위치 | 장면 그림 `jpg`, 읽어 준 목소리 `mp3` |
| 코드 | `lib/db.ts` | `lib/files.ts` |
| 규칙 | `firestore.rules` | `storage.rules` |

```
Firestore (데이터)
└─ users/{uid}                         사용자 정보 (이름, 이메일, 손님인지, 로그인 날짜)
   └─ stories/{storyId}                동화 한 권
        title, hero, input{name,age,likes,today},
        pages[ {text, scene} × 5 ],
        images{ p0: {path,url,contentType,size}, … }   ← 파일 "위치"만
        audio { p0: {path,url,contentType,size}, … }   ← 파일 "위치"만
        models{story,image,voice}, createdAt, updatedAt

Storage (파일)
└─ users/{uid}/stories/{storyId}/
     images/page-1.jpg … page-5.jpg     장면 그림
     audio/page-1.mp3 …                 읽어 준 목소리 (한 번 들은 장만)
```

- 동화 글을 다 쓰면 → **Firestore**에 저장돼요.
- 그림이 하나 나올 때마다 → **Storage**에 올리고, 그 위치를 Firestore 문서에 적어요.
- 🔊 읽어주기로 한 번 들은 장의 목소리도 Storage에 저장돼요. 다음에 다시 들을 때는 **새로 만들지 않아서 요금이 안 들어요.**
- 동화를 지우면 Storage 파일 → Firestore 문서 순서로 함께 지워져요.

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

## 🔥 Firebase 연결하기 (저장 기능 켜기)

Firebase 설정이 없어도 사이트는 예전처럼 동작해요 (저장만 안 돼요). 아래 순서대로 하면 저장이 켜져요.

### 1단계 · 프로젝트 만들기
1. https://console.firebase.google.com 에서 **프로젝트 추가** → 이름(예: `bedtime-story`) → 만들기
   (Google 애널리틱스는 꺼도 돼요)
2. 프로젝트 첫 화면에서 **웹 앱 추가**(`</>` 아이콘) → 앱 닉네임 적고 **앱 등록**
   - "Firebase 호스팅 설정"은 체크하지 마세요 (우리는 Vercel 을 써요)
3. 화면에 나오는 `firebaseConfig` 의 값 6개를 복사해 두세요
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`)

### 2단계 · 로그인 켜기 (Authentication)
1. 왼쪽 메뉴 **Authentication** → **시작하기**
2. **로그인 방법** 탭 → **Google** 사용 설정 (지원 이메일 고르기) → 저장
3. 같은 탭에서 **익명** 사용 설정 → 저장 (손님 저장에 필요해요)
4. **설정** 탭 → **승인된 도메인** → **도메인 추가** → `bedtime-story-dchoi.vercel.app`
   (`localhost` 는 처음부터 들어 있어요)

### 3단계 · 데이터베이스 만들기 (Firestore)
1. 왼쪽 메뉴 **Firestore Database** → **데이터베이스 만들기**
2. 위치: `asia-northeast3 (서울)` → **프로덕션 모드**로 시작
3. **규칙** 탭 → 내용을 다 지우고 이 폴더의 `firestore.rules` 내용을 붙여 넣고 → **게시**

### 4단계 · 파일 저장소 만들기 (Storage)
1. 왼쪽 메뉴 **Storage** → **시작하기**
   - ⚠️ 새 Storage 는 **Blaze(종량제) 요금제**로 바꾸라고 할 수 있어요. 결제 카드를 등록해야 하지만,
     무료 사용량 안에서는 요금이 거의 나오지 않아요. **예산 알림**(예: 1달러)을 꼭 켜 두세요.
2. 위치: `asia-northeast3 (서울)` → 만들기
3. **규칙** 탭 → `storage.rules` 내용을 붙여 넣고 → **게시**

### 5단계 · 설정 값 넣기
- **내 컴퓨터**: `.env` 의 `NEXT_PUBLIC_FIREBASE_…` 6칸에 1단계에서 복사한 값을 넣고 `npm run dev` 를 다시 켜요.
- **Vercel**: 프로젝트 → **Settings** → **Environment Variables** 에 같은 이름·값으로 6개를 넣고 → **Redeploy**

| Vercel Key | firebaseConfig 값 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

> `NEXT_PUBLIC_` 값들은 원래 화면에 공개되는 값이라 비밀이 아니에요.
> 누가 무엇을 볼 수 있는지는 3·4단계에서 넣은 **보안 규칙**이 지켜 줘요.

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
| "Google로 로그인"을 눌러도 안 돼요 | Firebase → Authentication → 설정 → **승인된 도메인**에 사이트 주소가 있는지 확인해요 |
| 책장에 "저장하지 못했어요" | Firestore·Storage **규칙**을 게시했는지, Authentication 에서 **익명** 로그인을 켰는지 확인해요 |
| 키를 실수로 GitHub에 올렸어요 | https://console.anthropic.com 에서 그 키를 **바로 삭제**하고 새 키를 만드세요 |

---

## ⚙️ 기술 메모
- Next.js 16 (App Router) + TypeScript
- 모델: `claude-sonnet-5-5` (스트리밍)
- 안전 필터가 동화를 거절하면 다른 모델이 이어서 쓰도록 `fallbacks: "default"` 를 켜 두었어요
- 그림: OpenAI `gpt-image-2.5-flare`, 1024×1024, `quality: "medium"` — 동화 1편에 그림 5장
- 읽어주기: OpenAI `gpt-4o-mini-tts`, 목소리 `sage` (바꾸려면 `lib/models.ts` 의 `VOICE`) — 처음 들을 때만 만들어 요금이 들고, 그다음부터는 저장된 파일을 써요
- 저장: Firebase Authentication(익명 + Google) · Firestore · Storage (`firebase` 13)
- ⚠️ 로그인이 없어서 주소를 아는 사람은 누구나 내 크레딧으로 동화·그림을 만들 수 있어요. 주소는 믿는 사람에게만!
