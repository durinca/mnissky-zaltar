// Fixed liturgical formulas (from the introductory pages of the psalter).
export interface Line { who: '' | 'V' | 'R'; sk: string; la: string }
export interface Formula { label: string; lines: Line[] }

const L = (who: Line['who'], sk: string, la: string): Line => ({ who, sk, la });

export function openingDeus(noAlleluia: boolean): Formula {
  return {
    label: 'Úvod',
    lines: [
      L('V', 'Bože, príď mi na pomoc.', 'Deus, in adiutórium meum inténde.'),
      L('R', 'Pane, ponáhľaj sa mi pomáhať.', 'Dómine, ad adiuvándum me festína.'),
      L('', 'Sláva Otcu i Synu i Duchu Svätému.', 'Glória Patri, et Fílio, et Spirítui Sancto.'),
      L('', 'Ako bolo na počiatku, tak nech je i teraz i vždycky i na veky vekov. Amen.' + (noAlleluia ? '' : ' Aleluja.'), 'Sicut erat in princípio, et nunc et semper, et in sǽcula sæculórum. Amen.' + (noAlleluia ? '' : ' Allelúia.')),
    ],
  };
}
export const openingDomine: Formula = {
  label: 'Úvod',
  lines: [
    L('V', 'Pane, otvor moje pery.', 'Dómine, lábia mea apéries.'),
    L('R', 'A moje ústa budú ohlasovať tvoju slávu.', 'Et os meum annuntiábit laudem tuam.'),
  ],
};

export const doxology: Line[] = [
  L('', 'Sláva Otcu i Synu i Duchu Svätému.', 'Glória Patri, et Fílio, et Spirítui Sancto.'),
  L('', 'Ako bolo na počiatku, tak nech je i teraz i vždycky i na veky vekov. Amen.', 'Sicut erat in princípio, et nunc et semper, et in sǽcula sæculórum. Amen.'),
];

export const ourFather: Formula = {
  label: 'Otče náš',
  lines: [
    L('', 'Otče náš, ktorý si na nebesiach, posväť sa meno tvoje, príď kráľovstvo tvoje, buď vôľa tvoja ako v nebi, tak i na zemi. Chlieb náš každodenný daj nám dnes a odpusť nám naše viny, ako aj my odpúšťame svojim vinníkom, a neuveď nás do pokušenia, ale zbav nás zlého. Amen.',
      'Pater noster, qui es in cælis, sanctificétur nomen tuum; advéniat regnum tuum; fiat volúntas tua, sicut in cælo et in terra. Panem nostrum cotidiánum da nobis hódie; et dimítte nobis débita nostra, sicut et nos dimíttimus debitóribus nostris; et ne nos indúcas in tentatiónem; sed líbera nos a malo. Amen.'),
  ],
};

/** Closing of Lauds / Vespers – three variants */
export const closingMain: Formula[] = [
  {
    label: 'Spoločne',
    lines: [
      L('V', 'Pán s vami.', 'Dóminus vobíscum.'), L('R', 'I s duchom tvojím.', 'Et cum spíritu tuo.'),
      L('V', 'Dobrorečme Pánovi.', 'Benedicámus Dómino.'), L('R', 'Bohu vďaka.', 'Deo grátias.'),
      L('V', 'Pomoc Pánova nech je vždy s nami.', 'Divínum auxílium máneat semper nobíscum.'), L('R', 'A s našimi neprítomnými bratmi. Amen.', 'Et cum frátribus nostris abséntibus. Amen.'),
    ],
  },
  {
    label: 'S kňazom',
    lines: [
      L('V', 'Pán s vami.', 'Dóminus vobíscum.'), L('R', 'I s duchom tvojím.', 'Et cum spíritu tuo.'),
      L('V', 'Nech vás žehná všemohúci Boh, Otec i Syn i Duch Svätý.', 'Benedícat vos omnípotens Deus, Pater, et Fílius, et Spíritus Sanctus.'), L('R', 'Amen.', 'Amen.'),
    ],
  },
  {
    label: 'Osamote',
    lines: [L('', 'Nech nás žehná Pán, nech nás chráni od zlého a nech nás privedie do večného života. Amen.', 'Dóminus nos benedícat, et ab omni malo deféndat, et ad vitam perdúcat ætérnam. Amen.')],
  },
];
export const closingMinor: Formula[] = [
  { label: 'Záver', lines: [L('V', 'Dobrorečme Pánovi.', 'Benedicámus Dómino.'), L('R', 'Bohu vďaka.', 'Deo grátias.')] },
];
export const closingKomp: Formula[] = [
  { label: 'Záver', lines: [L('', 'Pokojnú noc a vytrvalosť v dobrom až do konca nech nám dá všemohúci Pán.', 'Noctem quiétam et finem perféctum concédat nobis omnípotens.'), L('R', 'Amen.', 'Amen.')] },
];
