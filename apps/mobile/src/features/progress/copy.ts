// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const progressCopy = {
  title: "Хэмжилтийн явц",
  notEnough: "Хэмжилттэй хоёр шалгалтын дараа график харагдана",
  notice: "Энэ нь хэмжилтийн үзүүлэлт бөгөөд онош биш",
  summary: (count: number, top: number) =>
    `Хэмжилттэй ${count} шалгалт, хамгийн их үзүүлэлт ${top.toFixed(2)}`,
} as const;
