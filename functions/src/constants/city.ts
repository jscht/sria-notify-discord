// 광역시 이름
const MetropolitanCities = {
  seoul: "서울",
  busan: "부산",
  daegu: "대구",
  incheon: "인천",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
} as const;

// 경기도 시 이름
const GyeonggiCities = {
  suwon: "수원",
  seongnam: "성남",
  goyang: "고양",
  yongin: "용인",
  bucheon: "부천",
  ansan: "안산",
  namyangju: "남양주",
  hwaseong: "화성",
  pyeongtaek: "평택",
  uijeongbu: "의정부",
  paju: "파주",
  gimpo: "김포",
  gwangmyeong: "광명",
  siheung: "시흥",
  gunpo: "군포",
  icheon: "이천",
  yangju: "양주",
  anseong: "안성",
  guri: "구리",
} as const;

// 강원도 시 이름
const GangwonCities = {
  chuncheon: "춘천",
  wonju: "원주",
  gangneung: "강릉",
  donghae: "동해",
  taebaek: "태백",
  sokcho: "속초",
  samcheok: "삼척",
} as const;

// 충청북도 시 이름
const ChungbukCities = {
  cheongju: "청주",
  chungju: "충주",
  jecheon: "제천",
} as const;

// 충청남도 시 이름
const ChungnamCities = {
  cheonan: "천안",
  gongju: "공주",
  boryeong: "보령",
  asan: "아산",
  seosan: "서산",
  nonsan: "논산",
  gyeryong: "계룡",
  dangjin: "당진",
} as const;

// 전라북도 시 이름
const JeonbukCities = {
  jeonju: "전주",
  gunsan: "군산",
  iksan: "익산",
  jeongeup: "정읍",
  namwon: "남원",
  gimje: "김제",
} as const;

// 전라남도 시 이름
const JeonnamCities = {
  mokpo: "목포",
  yeosu: "여수",
  suncheon: "순천",
  naju: "나주",
  gwangyang: "광양",
} as const;

// 경상북도 시 이름
const GyeongbukCities = {
  pohang: "포항",
  gyeongju: "경주",
  gimcheon: "김천",
  andong: "안동",
  gumi: "구미",
  yeongju: "영주",
  yeongcheon: "영천",
  sangju: "상주",
  mungyeong: "문경",
  gyeongsan: "경산",
} as const;

// 경상남도 시 이름
const GyeongnamCities = {
  changwon: "창원",
  jinju: "진주",
  tongyeong: "통영",
  sacheon: "사천",
  gimhae: "김해",
  miryang: "밀양",
  geoje: "거제",
  yangsan: "양산",
} as const;

// 제주특별자치도 시 이름
const JejuCities = {
  jeju: "제주",
  seogwipo: "서귀포",
} as const;

// 모든 도시를 합친 객체
export const CITIES = {
  ...MetropolitanCities,
  ...GyeonggiCities,
  ...GangwonCities,
  ...ChungbukCities,
  ...ChungnamCities,
  ...JeonbukCities,
  ...JeonnamCities,
  ...GyeongbukCities,
  ...GyeongnamCities,
  ...JejuCities,
} as const;
