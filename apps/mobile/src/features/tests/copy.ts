// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const testsCopy = {
  title: "Шалгалтууд",
  intro: "Шалгалтаа сонгоно уу. Аль нь ч онош тавихгүй.",
  start: "Эхлэх",
  comingSoon: "Удахгүй",
  loading: "Сүүлийн шалгалтыг уншиж байна…",
  notYet: "Хараахан шалгаагүй",
  lastResult: (outcome: string, days: number) =>
    days === 0 ? `Сүүлд: ${outcome}, өнөөдөр` : `Сүүлд: ${outcome}, ${days} өдрийн өмнө`,
  checks: {
    strabismus: {
      title: "Хялар шалгах",
      what: "Хоёр нүдэнд туссан гэрлийн тусгалыг харьцуулж, хялрын шинж байгаа эсэхийг шалгана.",
      time: "3 секунд",
      distance: "35 см орчим",
      mark: "35 см",
      light: "Утасны гэрэл асна",
    },
    vision: {
      title: "Хараа шалгах",
      what: "Нүд тус бүрт янз бүрийн хэмжээтэй Е үсэг харуулж, хэр сайн харж байгааг шалгана.",
      time: "3 минут орчим",
      distance: "3 метр орчим",
      mark: "3 м",
    },
  },
  // Shown before the strabismus camera opens from this screen (#264).
  prepare: {
    title: "Бэлтгэл",
    intro: "Шалгалт 3 секунд үргэлжилнэ. Камер нээхээсээ өмнө:",
    steps: {
      distance: "Утсаа хүүхдийн нүүрнээс 35 см орчим зайд, нүдний түвшинд барина.",
      light: "Өрөөний гэрлийг бага зэрэг бүдгэрүүлнэ. Утасны гэрэл шалгалтын үед өөрөө асна.",
      look: "Хүүхэд камерын линз рүү харна.",
    },
    continue: "Камер нээх",
  },
} as const;
