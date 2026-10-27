// TODO(copy): Mongolian draft for team review (medical claims). Every tip keeps its source;
// never add wording that implies a diagnosis, healthy/normal eyes or a cure (CONTRIBUTING.md).

export type Source = { label: string; url: string };
export type Tip = { text: string; source: Source };
export type TipSection = { key: string; title: string; tips: Tip[] };

const AAO_STRABISMUS: Source = {
  label: "AAO: Strabismus in Children",
  url: "https://www.aao.org/eye-health/diseases/strabismus-in-children",
};
const AAO_SIGNS: Source = {
  label: "AAO: Common Eye Problems in Children",
  url: "https://www.aao.org/eye-health/tips-prevention/child-eye-problems-parents-should-never-ignore",
};
const AAO_SCREENS: Source = {
  label: "AAO: Screen Use for Kids",
  url: "https://www.aao.org/eye-health/tips-prevention/screen-use-kids",
};

export const tipSections: TipSection[] = [
  {
    key: "why",
    title: "Яагаад эрт шалгах нь чухал вэ?",
    tips: [
      {
        text: "Том хэмжээний судалгаагаар сургуулийн өмнөх насны 100 хүүхэд тутмын 3 орчимд хялар илэрсэн.",
        source: {
          label: "MEPEDS, Ophthalmology 2013 (3.24–3.55%, 6–72 сартай)",
          url: "https://doi.org/10.1016/j.ophtha.2013.03.001",
        },
      },
      {
        text: "Нүд зөрөхийг хүүхэд насанд нь эмчлэхгүй бол нэг нүдний хараа сулрах (залхуу нүд) эрсдэлтэй.",
        source: AAO_STRABISMUS,
      },
      {
        text: "Мэргэжилтнүүд 3–5 насанд дор хаяж нэг удаа харааг шалгуулахыг зөвлөдөг.",
        source: {
          label: "USPSTF зөвлөмж, 2017",
          url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/vision-in-children-ages-6-months-to-5-years-screening",
        },
      },
    ],
  },
  {
    key: "habits",
    title: "Нүдэнд ээлтэй дадал",
    tips: [
      {
        text: "2–4 настай хүүхдийн дэлгэцийн хэрэглээ өдөрт 1 цагаас хэтрэхгүй, бага байх тусам сайн. 1 нас хүрээгүй хүүхдэд дэлгэц зөвлөдөггүй.",
        source: {
          label: "ДЭМБ, 2019",
          url: "https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more",
        },
      },
      {
        text: "Гадаа өнгөрүүлэх цаг, ялангуяа бага насанд, ойрын хараа муудахыг удаашруулж болно. Хүүхдийн нүдний эмч нар өдөрт 1–2 цаг гадаа байхыг зөвлөдөг.",
        source: {
          label: "AAO: Prescription for Keeping Children Out of Glasses",
          url: "https://www.aao.org/eye-health/news/prevent-childhood-myopia-sunshine-outdoors",
        },
      },
      {
        text: "Дэлгэцийг гарын урттай тэнцэх зайд барьж, хааяа холын зүйл рүү харж, нүдээ анивчуулж амраагаарай.",
        source: AAO_SCREENS,
      },
    ],
  },
  {
    key: "signs",
    title: "Нүдний эмчид хэзээ хандах вэ?",
    tips: [
      {
        text: "Хоёр нүд өөр өөр зүг рүү харж байвал хүүхдийн нүдний эмчид аль болох эрт үзүүлээрэй.",
        source: AAO_SIGNS,
      },
      {
        text: "Хүүхэд нэг нүдээ аньж эсвэл толгойгоо хазайлгаж харж байвал.",
        source: AAO_STRABISMUS,
      },
      {
        text: "Зурган дээр нэг нүдэнд цагаан, шар эсвэл бусдаас өөр гэрлийн тусгал харагдвал тэр зургийг эмчид үзүүлээрэй.",
        source: AAO_SIGNS,
      },
    ],
  },
];

export const tipsCopy = {
  title: "Эцэг эхэд: яагаад чухал вэ?",
  sourcePrefix: "Эх сурвалж:",
  notice:
    "Энэ апп зөвхөн нүдний эмчид үзүүлэх нь зүйтэй эсэхийг санал болгоно. Онош тавихгүй, нүдний эмчийн үзлэгийг орлохгүй.",
  openTips: "Эцэг эхэд: яагаад чухал вэ?",
} as const;
