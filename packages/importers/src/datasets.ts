/**
 * The open datasets the importers read (SDD section 10, PRD section 6). NFR-62: the licence and
 * attribution here are stored on every import run and in the download manifest. Level lists are
 * not listed: they are read from the committed copy, never downloaded (FR-233).
 */
export interface Dataset {
  licence: string;
  attribution: string;
  homepage: string;
  /** Files the download script fetches; `.gz` files are stored unzipped. */
  urls: string[];
}

const TATOEBA = 'https://downloads.tatoeba.org/exports';

export const datasets = {
  kanjidic2: {
    licence: 'CC BY-SA 4.0',
    attribution: 'KANJIDIC2, Electronic Dictionary Research and Development Group (EDRDG)',
    homepage: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    urls: ['https://www.edrdg.org/kanjidic/kanjidic2.xml.gz'],
  },
  jmdict: {
    licence: 'CC BY-SA 4.0',
    attribution: 'JMdict, Electronic Dictionary Research and Development Group (EDRDG)',
    homepage: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
    // http: https://ftp.edrdg.org fails the TLS handshake.
    urls: ['http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz'],
  },
  kanjivg: {
    licence: 'CC BY-SA 3.0',
    attribution: 'KanjiVG, Ulrich Apel and contributors',
    homepage: 'https://kanjivg.tagaini.net/',
    // Pinned release; bump it to take a newer one.
    urls: [
      'https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz',
    ],
  },
  tatoeba: {
    licence: 'CC BY 2.0 FR',
    attribution: 'Tatoeba contributors',
    homepage: 'https://tatoeba.org/',
    // Stored bzip2-compressed as downloaded; the Tatoeba importer reads them.
    urls: [
      `${TATOEBA}/per_language/jpn/jpn_sentences_detailed.tsv.bz2`,
      `${TATOEBA}/per_language/eng/eng_sentences_detailed.tsv.bz2`,
      `${TATOEBA}/per_language/jpn/jpn-eng_links.tsv.bz2`,
      `${TATOEBA}/user_languages.tar.bz2`,
    ],
  },
} satisfies Record<string, Dataset>;

export type DatasetName = keyof typeof datasets;
