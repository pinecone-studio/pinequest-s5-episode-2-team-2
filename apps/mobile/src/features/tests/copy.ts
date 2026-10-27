// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const testsCopy = {
  title: "Шалгалтууд",
  intro: "Шалгалтаа сонгоно уу. Аль нь ч онош тавихгүй.",
  start: "Эхлэх",
  comingSoon: "Удахгүй",
  notYet: "Хараахан шалгаагүй",
  lastResult: (outcome: string, days: number) =>
    days === 0 ? `Сүүлд: ${outcome}, өнөөдөр` : `Сүүлд: ${outcome}, ${days} өдрийн өмнө`,
  checks: {
    strabismus: {
      title: "Хялар шалгах",
      what: "Хоёр нүдэнд туссан гэрлийн тусгалыг харьцуулж, хялрын шинж байгаа эсэхийг шалгана.",
      time: "3 секунд",
      needs: "Гэрэл асаалттай, утас 35 см орчим зайд",
    },
    vision: {
      title: "Хараа шалгах",
      what: "Нүд тус бүрт янз бүрийн хэмжээтэй Е үсэг харуулж, хэр сайн харж байгааг шалгана.",
      time: "3 минут орчим",
      needs: "3 метр орчим зай",
    },
  },
} as const;
