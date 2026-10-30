// 동화가 매번 비슷해지지 않도록, 이야기를 만들 때마다 "설계도"를 하나씩 무작위로 골라요.
// (같은 아이 정보를 넣어도 줄거리·장소·시간·문체·색감이 달라져요)
// 항목을 더 넣고 싶으면 아래 목록에 한 줄씩 더하면 돼요.

const PLOTS = [
  "누군가를 도와주는 이야기 (잃어버린 물건 찾아 주기, 선물 준비 돕기, 아픈 친구에게 수프 끓여 주기)",
  "친구들과 함께 무언가를 만드는 이야기 (케이크, 연, 작은 집, 꽃밭, 노래)",
  "무섭지 않은 작은 수수께끼를 풀어 가는 이야기 (사라진 단추, 문 앞의 수수께끼 쪽지, 발자국 따라가기)",
  "만나는 친구가 한 명씩 늘어나며 같은 말이 되풀이되는 쌓기 이야기",
  "이솝 우화처럼 작은 깨달음이 있는 이야기 (나눔, 기다림, 천천히 해도 괜찮아, 서로 다른 게 좋아)",
  "자연이 바뀌는 것을 지켜보는 이야기 (씨앗이 싹트는 하루, 첫눈, 꽃이 피는 날, 무지개)",
  "편지나 도시락을 전하러 마을을 한 바퀴 도는 배달 이야기",
  "작은 잔치나 축제를 준비하는 이야기",
  "처음 해 보는 일에 살짝 걱정하다가 용기 내서 해내는 이야기 (무섭지 않게)",
  "아이가 좋아하는 것이 주인공이 되는 이야기 (아이는 이야기 끝에 반갑게 만나는 친구로 나와요)",
  "작은 가게(빵집, 우체국, 꽃집, 장난감 가게)에서 하루 동안 일해 보는 이야기",
  "서로 바꿔 보기 이야기 (하루 동안 역할이나 집을 바꿔 보고 서로를 더 이해하게 돼요)",
];

const SETTINGS = [
  "파도 소리가 들리는 바닷가 마을",
  "구름 위의 작은 빵집",
  "나무 속에 있는 숲속 도서관",
  "들꽃이 핀 시골 기차역",
  "할머니 댁 텃밭과 마당",
  "눈이 소복이 쌓인 산골 마을",
  "산호와 해초가 흔들리는 바다 밑 정원",
  "야자수가 있는 오아시스 시장",
  "오래된 장난감 가게의 다락방",
  "호숫가 캠핑장",
  "비 갠 뒤의 골목길",
  "꽃이 가득 핀 작은 섬",
  "버섯 집들이 모여 있는 숲속 마을",
  "열기구가 떠다니는 언덕",
];

const TIMES = ["이른 아침", "해가 반짝이는 한낮", "노을 지는 저녁", "비가 막 그친 오후", "함박눈이 내리는 날", "바람이 선선한 가을 낮", "봄비가 내리는 아침"];

const VOICES = [
  "대화가 많고 말투가 살아 있게",
  "'사각사각', '퐁당' 같은 소리·모양 흉내말을 풍부하게",
  "장면마다 되풀이되는 짧은 후렴구를 넣어서",
  "누군가에게 받은 편지로 이야기를 시작해서",
  "주인공이 부르는 짧은 노래 한 소절을 넣어서",
  "듣는 아이에게 가끔 다정하게 질문을 건네면서",
];

// 그림 색감 (영어: 그림 AI에게 그대로 보내요)
const PALETTES = [
  "spring blossom pastels: cherry pink, fresh green, soft butter yellow, morning light",
  "summer seaside: turquoise water, warm sand, white sails, bright clear daylight",
  "autumn harvest: amber, russet, mustard and plum, low golden afternoon sun",
  "winter snow: powder blue, silver, warm red accents, soft overcast glow",
  "golden meadow: honey gold, sage and cornflower blue, late afternoon haze",
  "rainy day: teal, lilac and slate grey with shiny reflections and a rainbow",
  "cozy bakery: cream, strawberry red, cocoa brown, warm indoor light",
  "deep forest: moss green, mushroom brown, dappled sunlight through leaves",
  "sunset sky: coral, peach and lavender, long soft shadows",
  "underwater: aqua, coral pink, pearl white, shimmering light rays",
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export type StorySeed = { plot: string; setting: string; time: string; voice: string; palette: string };

export function pickSeed(): StorySeed {
  return { plot: pick(PLOTS), setting: pick(SETTINGS), time: pick(TIMES), voice: pick(VOICES), palette: pick(PALETTES) };
}

export function describeSeed(s: StorySeed) {
  return [
    "이번 동화의 설계도 (이대로 써 주세요):",
    `- 줄거리 틀: ${s.plot}`,
    `- 장소: ${s.setting} (아이가 좋아하는 것과 어울리게 살짝 바꿔도 돼요)`,
    `- 때: ${s.time}`,
    `- 문체: ${s.voice}`,
    `- 그림 색감: ${s.palette}`,
  ].join("\n");
}
