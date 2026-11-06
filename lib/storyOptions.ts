// 동화 길이와 나이별 수준을 한곳에서 정해요. (화면과 서버가 같이 써요)

/** 고를 수 있는 이야기 길이 (장 수) */
export const LENGTHS = [
  { pages: 3, label: "짧게" },
  { pages: 5, label: "보통" },
  { pages: 7, label: "길게" },
  { pages: 10, label: "아주 길게" },
] as const;

export const DEFAULT_PAGES = 5;
export const MAX_PAGES = 10; // firestore.rules 의 pages.size() <= 10 과 같아야 해요

export const isAllowedPages = (n: number) => LENGTHS.some((l) => l.pages === n);

/** 나이별 글 수준: 한 장의 글자 수와 쓰는 방법 */
type AgeLevel = { band: string; charsPerPage: [number, number]; guide: string };

const LEVELS: { maxAge: number; level: AgeLevel }[] = [
  {
    maxAge: 3,
    level: {
      band: "1~3살",
      charsPerPage: [60, 100],
      guide:
        "아주 짧은 문장(한 문장에 낱말 3~6개). '꿀꿀', '데굴데굴' 같은 소리·모양 흉내말을 많이 쓰고, 같은 말을 되풀이해요. 동물·과일·탈것처럼 아이가 아는 것만 나오고, 일어나는 일은 한 가지뿐이에요. 어려운 낱말은 쓰지 않아요.",
    },
  },
  {
    maxAge: 5,
    level: {
      band: "4~5살",
      charsPerPage: [130, 180],
      guide:
        "짧고 쉬운 문장. 되풀이되는 구절을 넣고, '그래서 ~했어요'처럼 앞뒤가 바로 이어지는 단순한 줄거리로 써요. '기뻐요', '조금 속상해요'처럼 마음에 이름을 붙여 줘요.",
    },
  },
  {
    maxAge: 7,
    level: {
      band: "6~7살",
      charsPerPage: [180, 240],
      guide:
        "대화를 넉넉히 넣고, 친구들과 함께 작은 문제를 풀어 가요. 새로운 낱말 1~2개를 앞뒤 문맥으로 뜻을 알 수 있게 넣어요. 문장은 조금 길어져도 괜찮아요.",
    },
  },
  {
    maxAge: 10,
    level: {
      band: "8~10살",
      charsPerPage: [240, 320],
      guide:
        "풍경과 소리를 생생하게 묘사하고, 등장인물의 마음이 조금씩 바뀌는 모습을 보여 줘요. 작은 반전이나 수수께끼, 쉬운 비유를 써도 좋아요.",
    },
  },
  {
    maxAge: 12,
    level: {
      band: "11~12살",
      charsPerPage: [280, 360],
      guide:
        "여러 등장인물의 생각과 입장을 보여 주고, 짜임새 있는 줄거리로 써요. 교훈은 직접 말하지 않고 이야기 속에서 스스로 느끼게 해요. 어휘와 문장은 이 나이에 맞게 풍부하게 써요.",
    },
  },
];

export function ageLevel(age: number): AgeLevel {
  return (LEVELS.find((l) => age <= l.maxAge) ?? LEVELS[LEVELS.length - 1]).level;
}

/** 소리 내어 천천히 읽으면 몇 분쯤 걸리는지 (1분에 약 230자, 실제로 나오는 글은 목표의 짧은 쪽에 가까워요) */
export function readingMinutes(pages: number, age: number) {
  const [min] = ageLevel(age).charsPerPage;
  return Math.max(1, Math.round((pages * min) / 230));
}
